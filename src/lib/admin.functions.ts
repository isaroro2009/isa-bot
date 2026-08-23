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

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      last_sign_in_at: authMap.get(p.id) ?? null,
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

