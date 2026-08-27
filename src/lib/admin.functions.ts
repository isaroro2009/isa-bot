import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("No se pudo verificar el rol");
  if (!data) throw new Error("Forbidden: se requiere rol admin");
}

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_premium: boolean;
  created_at: string;
  roles: string[];
  last_sign_in_at: string | null;
  ibc_balance: number;
  unlimited_coins: boolean;
};


export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, avatar_url, phone, is_premium, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw pErr;

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw rErr;

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    // fetch auth users for last_sign_in_at
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const authMap = new Map<string, string | null>();
    for (const u of usersList?.users ?? []) {
      authMap.set(u.id, u.last_sign_in_at ?? null);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wallets } = await (supabaseAdmin as any)
      .from("ibc_wallets")
      .select("user_id, balance, unlimited_coins");
    const walletMap = new Map<string, { balance: number; unlimited: boolean }>();
    for (const w of (wallets ?? []) as Array<{ user_id: string; balance: number; unlimited_coins: boolean }>) {
      walletMap.set(w.user_id, { balance: w.balance ?? 0, unlimited: Boolean(w.unlimited_coins) });
    }

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      last_sign_in_at: authMap.get(p.id) ?? null,
      ibc_balance: walletMap.get(p.id)?.balance ?? 0,
      unlimited_coins: walletMap.get(p.id)?.unlimited ?? false,

    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "admin" | "user"; grant: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("No puedes quitarte tu propio rol admin");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw error;
    }
    return { ok: true };
  });

export const setUserPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isPremium: boolean; days?: number | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.isPremium) {
      // Quitar Premium
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_premium: false,
          premium_expires_at: null,
          premium_gift_days: null,
          premium_notice_seen: true,
        })
        .eq("id", data.userId);
      if (error) throw error;
      return { ok: true };
    }

    // Dar Premium: days = null → permanente; number → días desde ahora
    const days = data.days ?? null;
    const expiresAt =
      days && days > 0
        ? new Date(Date.now() + days * 86400_000).toISOString()
        : null;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_premium: true,
        premium_expires_at: expiresAt,
        premium_gift_days: days,
        premium_notice_seen: false, // dispara el aviso al usuario
      })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta desde aquí");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    return { roles: (data ?? []).map((r: { role: string }) => r.role) };
  });

export type EmailLogRow = {
  id: string;
  recipient: string;
  subject: string;
  kind: string;
  status: string;
  reason: string | null;
  html: string | null;
  created_at: string;
};

export type MailStatus = {
  configured: boolean;
  provider: "brevo" | "resend" | "none";
  from: string;
  reason?: string;
};

/** Registro de correos que IsaBot ha enviado (solo admin). */
export const listEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: EmailLogRow[]; pendingWelcome: number; mailConfigured: boolean; mail: MailStatus }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data, error } = await admin
      .from("email_log")
      .select("id, recipient, subject, kind, status, reason, html, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("welcome_email_sent_at", null);

    const { mailStatus } = await import("@/lib/mailer.server");
    const mail = mailStatus();

    return {
      rows: (data ?? []) as EmailLogRow[],
      pendingWelcome: count ?? 0,
      mailConfigured: mail.configured,
      mail,
    };
  });

/** Envía un correo de prueba a la propia admin para verificar el proveedor. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to?: string }) => input)
  .handler(async ({ data, context }): Promise<{ sent: boolean; reason?: string; to: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const { sendEmail, emailLayout, mailStatus } = await import("@/lib/mailer.server");

    let to = (data.to ?? "").trim();
    if (!to) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("email")
        .eq("id", context.userId)
        .maybeSingle();
      to = prof?.email ?? "";
    }
    if (!to.includes("@")) return { sent: false, reason: "no_email", to };

    const status = mailStatus();
    if (!status.configured) return { sent: false, reason: status.reason ?? "email_not_configured", to };

    const html = emailLayout({
      title: "¡El correo de IsaBot funciona! 💜",
      body: `<p>Este es un correo de prueba enviado desde el panel admin.</p>
        <p>Proveedor: <strong>${status.provider}</strong> · Remitente: <strong>${status.from}</strong></p>`,
      ctaLabel: "Abrir IsaBot",
      ctaUrl: "https://isa-bot.lovable.app",
    });

    const res = await sendEmail({ to, subject: "Prueba de correo · IsaBot 💜", html, kind: "other" });
    return { ...res, to };
  });


/** Fuerza el reenvío del correo de bienvenida a una usuaria (aunque ya se haya enviado). */
export const forceWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }): Promise<{ sent: boolean; reason?: string; email?: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, isMailConfigured } = await import("@/lib/mailer.server");
    const { buildWelcomeEmail } = await import("@/lib/welcome-email.server");

    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, referral_code")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw error;
    if (!prof?.email) return { sent: false, reason: "no_email" };
    if (!isMailConfigured()) return { sent: false, reason: "email_not_configured", email: prof.email };

    const name = prof.display_name || prof.email.split("@")[0];
    const { subject, html } = buildWelcomeEmail({ name, referralCode: prof.referral_code });
    const res = await sendEmail({ to: prof.email, subject, html, kind: "welcome" });

    if (res.sent) {
      await supabaseAdmin
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", prof.id);
    }
    return { ...res, email: prof.email };
  });

/** Envía la bienvenida a todas las usuarias que aún no la han recibido (máx. 50 por tanda). */
export const sendPendingWelcomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ total: number; sent: number; failed: number; reason?: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, isMailConfigured } = await import("@/lib/mailer.server");
    const { buildWelcomeEmail } = await import("@/lib/welcome-email.server");

    const { data: pending, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, referral_code")
      .is("welcome_email_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    const rows = pending ?? [];
    if (!isMailConfigured()) {
      return { total: rows.length, sent: 0, failed: rows.length, reason: "email_not_configured" };
    }

    let sent = 0;
    let failed = 0;
    for (const p of rows) {
      if (!p.email) { failed++; continue; }
      const name = p.display_name || p.email.split("@")[0];
      const { subject, html } = buildWelcomeEmail({ name, referralCode: p.referral_code });
      const res = await sendEmail({ to: p.email, subject, html, kind: "welcome" });
      if (res.sent) {
        sent++;
        await supabaseAdmin
          .from("profiles")
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq("id", p.id);
      } else {
        failed++;
      }
    }
    return { total: rows.length, sent, failed };
  });


/* ============================================================
   👑 Superpoderes de admin: crear usuarias y gestionar coins
   ============================================================ */

/** Crea una cuenta manualmente (correo ya confirmado) con saldo inicial de IBC. */
export const createUserManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; displayName?: string; initialCoins?: number }) => {
    const email = (input.email ?? "").trim().toLowerCase();
    const password = String(input.password ?? "");
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(email)) throw new Error("Correo inválido");
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    const coins = Math.max(0, Math.min(999999, Math.round(Number(input.initialCoins ?? 0) || 0)));
    return { email, password, displayName: (input.displayName ?? "").trim().slice(0, 80), initialCoins: coins };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; userId: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName || data.email.split("@")[0] },
    });
    if (error) throw new Error(error.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("No se pudo crear la cuenta");

    if (data.initialCoins > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = supabaseAdmin as any;
      await admin.from("ibc_wallets").upsert(
        { user_id: userId, balance: data.initialCoins },
        { onConflict: "user_id" },
      );
      await admin.from("ibc_transactions").insert({
        user_id: userId,
        amount: data.initialCoins,
        type: "earn",
        description: "Saldo inicial asignado por admin",
      });
    }
    return { ok: true, userId };
  });

/** Ajusta manualmente el saldo de IBC de cualquier usuaria. */
export const setUserCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; balance: number }) => {
    const userId = String(input.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Usuario inválido");
    const balance = Math.max(0, Math.min(999999, Math.round(Number(input.balance) || 0)));
    return { userId, balance };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; balance: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: current } = await admin
      .from("ibc_wallets")
      .select("balance")
      .eq("user_id", data.userId)
      .maybeSingle();

    const { error } = await admin
      .from("ibc_wallets")
      .upsert({ user_id: data.userId, balance: data.balance }, { onConflict: "user_id" });
    if (error) throw error;

    const delta = data.balance - (current?.balance ?? 0);
    if (delta !== 0) {
      await admin.from("ibc_transactions").insert({
        user_id: data.userId,
        amount: delta,
        type: delta > 0 ? "earn" : "spend",
        description: "Ajuste manual del panel admin",
      });
    }
    return { ok: true, balance: data.balance };
  });

/** Activa o desactiva el "Modo Coins Infinitas ♾️" para una cuenta. */
export const setUnlimitedCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; unlimited: boolean }) => {
    const userId = String(input.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Usuario inválido");
    return { userId, unlimited: Boolean(input.unlimited) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const payload: Record<string, unknown> = { user_id: data.userId, unlimited_coins: data.unlimited };
    if (data.unlimited) payload["balance"] = 999999;
    const { error } = await admin.from("ibc_wallets").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });

export type IntegrationStatus = {
  id: string;
  label: string;
  status: "active" | "pending";
  missing: string[];
  hint: string;
};

export type WhatsAppConfig = {
  url: string;
  instance: string;
  hasKey: boolean;
  connected: boolean;
  qr: string | null;
  state: string | null;
  error: string | null;
};

/** Estado de las integraciones externas (sin exponer valores de secretos). */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationStatus[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { readWhatsAppConfig } = await import("@/lib/whatsapp.server");
    const cfg = await readWhatsAppConfig();

    const missing: string[] = [];
    if (!cfg.url) missing.push("EVOLUTION_API_URL");
    if (!cfg.key) missing.push("EVOLUTION_API_KEY");

    return [
      {
        id: "whatsapp",
        label: "WhatsApp — Evolution API / Node Session",
        status: missing.length === 0 ? "active" : "pending",
        missing,
        hint:
          missing.length === 0
            ? `Sesión "${cfg.instance}" · webhook activo en /api/public/whatsapp`
            : "Sin credenciales · conecta tu sesión escaneando el QR desde este panel",
      },
    ];
  });

/** Lee la configuración de Evolution API (sin exponer la API key). */
export const getWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppConfig> => {
    await assertAdmin(context.supabase, context.userId);
    const { readWhatsAppConfig, evolutionStatus } = await import("@/lib/whatsapp.server");
    const cfg = await readWhatsAppConfig();
    const live = await evolutionStatus(cfg);
    return {
      url: cfg.url,
      instance: cfg.instance,
      hasKey: Boolean(cfg.key),
      connected: live.connected,
      qr: live.qr,
      state: live.state,
      error: live.error,
    };
  });

/** Guarda URL / API key / instancia de Evolution API. */
export const saveWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; key?: string; instance?: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const rows: { key: string; value: string; updated_by: string; updated_at: string }[] = [];
    const push = (k: string, v?: string) => {
      if (typeof v === "string" && v.trim())
        rows.push({
          key: k,
          value: v.trim(),
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        });
    };
    push("EVOLUTION_API_URL", data.url);
    push("EVOLUTION_API_KEY", data.key);
    push("EVOLUTION_INSTANCE", data.instance);

    if (rows.length) {
      const { error } = await admin.from("integration_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }
    return { ok: true };
  });

/** Crea/reinicia la sesión y devuelve el QR para escanear con WhatsApp. */
export const connectWhatsAppQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ qr: string | null; state: string | null; error: string | null }> => {
    await assertAdmin(context.supabase, context.userId);
    const { readWhatsAppConfig, evolutionConnect } = await import("@/lib/whatsapp.server");
    return evolutionConnect(await readWhatsAppConfig());
  });

