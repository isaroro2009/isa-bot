import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, currentWeekKey } from "./gift-week";

export type WeeklyGiftRow = {
  id: string;
  week_key: string;
  target_user_id: string | null;
  target_email: string | null;
  kind: string;
  title: string;
  message: string | null;
  image_url: string | null;
  status: string;
  queue_order: number;
  published_at: string | null;
  created_at: string;
};

export const listWeeklyGifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeeklyGiftRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: gifts, error } = await admin
      .from("weekly_gifts")
      .select(
        "id, week_key, target_user_id, kind, title, message, image_url, status, queue_order, published_at, created_at",
      )
      .order("status", { ascending: true })
      .order("queue_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const ids = Array.from(
      new Set((gifts ?? []).map((g: { target_user_id: string | null }) => g.target_user_id).filter(Boolean)),
    ) as string[];
    const emailMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id, email").in("id", ids);
      for (const p of profs ?? []) emailMap.set(p.id, p.email);
    }
    return (gifts ?? []).map((g: WeeklyGiftRow) => ({
      ...g,
      target_email: g.target_user_id ? emailMap.get(g.target_user_id) ?? null : null,
    }));
  });

export const createWeeklyGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    week_key?: string | null;
    kind: string;
    title: string;
    message?: string | null;
    image_url?: string | null;
    target_email?: string | null;
    /** true = se queda en la cola para publicarse automáticamente el lunes */
    queued?: boolean;
  }) => {
    if (!input.title?.trim()) throw new Error("El título es obligatorio");
    if (input.title.length > 120) throw new Error("Título demasiado largo");
    if (input.message && input.message.length > 1000) throw new Error("Mensaje demasiado largo");
    if (input.image_url && input.image_url.length > 500_000) throw new Error("Imagen demasiado grande");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    let targetUserId: string | null = null;
    if (data.target_email && data.target_email.trim()) {
      const { data: prof, error: pErr } = await admin
        .from("profiles")
        .select("id")
        .eq("email", data.target_email.trim().toLowerCase())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("No encontré una usuaria con ese correo");
      targetUserId = prof.id;
    }

    const queued = data.queued !== false;
    let queueOrder = 0;
    if (queued) {
      const { data: last } = await admin
        .from("weekly_gifts")
        .select("queue_order")
        .eq("status", "queued")
        .order("queue_order", { ascending: false })
        .limit(1);
      queueOrder = (last?.[0]?.queue_order ?? 0) + 1;
    }

    const { error } = await admin.from("weekly_gifts").insert({
      week_key: (data.week_key || "").trim() || currentWeekKey(),
      kind: data.kind || "wallpaper",
      title: data.title.trim(),
      message: data.message?.trim() || null,
      image_url: data.image_url?.trim() || null,
      target_user_id: targetUserId,
      created_by: context.userId,
      status: queued ? "queued" : "published",
      queue_order: queueOrder,
      published_at: queued ? null : new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteWeeklyGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("weekly_gifts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Mueve un regalo en la cola (delta -1 sube, +1 baja). */
export const moveWeeklyGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; delta: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: queue } = await admin
      .from("weekly_gifts")
      .select("id, queue_order")
      .eq("status", "queued")
      .order("queue_order", { ascending: true });
    const list = (queue ?? []) as { id: string; queue_order: number }[];
    const idx = list.findIndex((g) => g.id === data.id);
    const target = idx + (data.delta < 0 ? -1 : 1);
    if (idx < 0 || target < 0 || target >= list.length) return { ok: true };
    const a = list[idx];
    const b = list[target];
    await admin.from("weekly_gifts").update({ queue_order: b.queue_order }).eq("id", a.id);
    await admin.from("weekly_gifts").update({ queue_order: a.queue_order }).eq("id", b.id);
    return { ok: true };
  });

/** Publica ahora el siguiente regalo de la cola (mismo proceso que el cron del lunes). */
export const publishNextGiftNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: queued } = await admin
      .from("weekly_gifts")
      .select("id, title, message, target_user_id")
      .eq("status", "queued")
      .order("queue_order", { ascending: true })
      .limit(1);
    const next = queued?.[0];
    if (!next) throw new Error("La cola está vacía: agrega un regalo primero 🎁");

    await admin
      .from("weekly_gifts")
      .update({ status: "published", published_at: new Date().toISOString(), week_key: currentWeekKey() })
      .eq("id", next.id);

    const { sendEmail, emailLayout, isMailConfigured } = await import("@/lib/mailer.server");
    let sent = 0;
    if (isMailConfigured()) {
      let q = admin
        .from("profiles")
        .select("id, email, display_name, unsubscribe_token, is_premium")
        .eq("email_reminders_enabled", true);
      q = next.target_user_id ? q.eq("id", next.target_user_id) : q.eq("is_premium", true);
      const { data: people } = await q;
      for (const p of people ?? []) {
        const res = await sendEmail({
          kind: "weekly_gift",
          to: p.email,
          subject: `🎁 Tu regalo semanal ya está listo: ${next.title}`,
          html: emailLayout({
            title: `🎁 ${next.title}`,
            body: `<p>Hola ${p.display_name || "creativa"} 💕</p><p>${next.message || "Isabella te dejó un regalito nuevo dentro de IsaBot."}</p>`,
            ctaLabel: "Abrir mi regalo",
            ctaUrl: "https://isa-bot.lovable.app",
            unsubscribeUrl: `https://isa-bot.lovable.app/api/public/unsubscribe?token=${p.unsubscribe_token}`,
          }),
        });
        if (res.sent) sent += 1;
      }
    }
    return { ok: true, emailsSent: sent, mailConfigured: isMailConfigured() };
  });

export const getGiftAutomationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isMailConfigured } = await import("@/lib/mailer.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { count } = await admin
      .from("weekly_gifts")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");
    return { queued: count ?? 0, mailConfigured: isMailConfigured(), weekKey: currentWeekKey() };
  });

