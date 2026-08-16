import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://isa-bot.lovable.app";

function authorized(request: Request): boolean {
  // Secreto exclusivo del servidor. NUNCA usar la publishable/anon key: es pública.
  const key = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-key") ?? "";
  if (!key || key.length < 16 || !provided) return false;
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function currentWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/public/hooks/weekly-gift-publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const weekKey = currentWeekKey();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        // ¿Ya se publicó algo esta semana?
        const { data: already } = await admin
          .from("weekly_gifts")
          .select("id")
          .eq("status", "published")
          .eq("week_key", weekKey)
          .limit(1);
        if (already && already.length) {
          return Response.json({ ok: true, skipped: "already_published", weekKey });
        }

        const { data: queued } = await admin
          .from("weekly_gifts")
          .select("id, title, message, target_user_id")
          .eq("status", "queued")
          .order("queue_order", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1);

        const next = queued?.[0];
        if (!next) return Response.json({ ok: true, skipped: "empty_queue", weekKey });

        const { error } = await admin
          .from("weekly_gifts")
          .update({ status: "published", published_at: new Date().toISOString(), week_key: weekKey })
          .eq("id", next.id);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        // Avisar por correo
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        let query = admin
          .from("profiles")
          .select("id, email, display_name, unsubscribe_token, email_reminders_enabled, is_premium")
          .eq("email_reminders_enabled", true);
        query = next.target_user_id
          ? query.eq("id", next.target_user_id)
          : query.eq("is_premium", true);
        const { data: people } = await query;

        let sent = 0;
        for (const p of people ?? []) {
          const res = await sendEmail({
            kind: "weekly_gift",
            to: p.email,
            subject: `🎁 Tu regalo semanal ya está listo: ${next.title}`,
            html: emailLayout({
              title: `🎁 ${next.title}`,
              body: `<p>Hola ${p.display_name || "creativa"} 💕</p><p>${
                next.message || "Isabella te dejó un regalito nuevo dentro de IsaBot. Ábrelo desde <b>Herramientas → Regalo Semanal</b>."
              }</p>`,
              ctaLabel: "Abrir mi regalo",
              ctaUrl: APP_URL,
              unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${p.unsubscribe_token}`,
            }),
          });
          if (res.sent) sent += 1;
        }

        return Response.json({ ok: true, published: next.id, weekKey, emailsSent: sent });
      },
    },
  },
});
