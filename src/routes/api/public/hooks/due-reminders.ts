import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://isa-bot.lovable.app";
// Zona horaria de referencia para la hora elegida por la usuaria (Colombia, UTC-5).
const TZ_OFFSET_HOURS = -5;
const WINDOW_MINUTES = 20;

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

type Row = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  message: string | null;
  frequency: string;
  send_hour: number;
  send_minute: number;
  weekday: number | null;
  once_date: string | null;
  scheduled_at: string | null;
  last_sent_at: string | null;

};

export const Route = createFileRoute("/api/public/hooks/due-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const now = new Date();
        const local = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
        const localMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
        const localDate = local.toISOString().slice(0, 10);
        const localWeekday = local.getUTCDay(); // 0 = domingo

        const { data: reminders, error } = await admin
          .from("user_reminders")
          .select(
            "id, user_id, kind, title, message, frequency, send_hour, send_minute, weekday, once_date, scheduled_at, last_sent_at",
          )

          .eq("active", true)
          .limit(500);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const due = (reminders ?? []).filter((r: Row) => {
          if (r.last_sent_at) {
            const lastLocal = new Date(new Date(r.last_sent_at).getTime() + TZ_OFFSET_HOURS * 3600000);
            if (lastLocal.toISOString().slice(0, 10) === localDate) return false;
          }
          // Recordatorio con fecha/hora exacta (creado desde el chat)
          if (r.scheduled_at) {
            const when = new Date(r.scheduled_at).getTime();
            return now.getTime() >= when && now.getTime() <= when + WINDOW_MINUTES * 60000;
          }
          const target = r.send_hour * 60 + (r.send_minute ?? 0);
          if (localMinutes < target || localMinutes > target + WINDOW_MINUTES) return false;
          if (r.frequency === "weekly") return (r.weekday ?? 1) === localWeekday;
          if (r.frequency === "once") return r.once_date === localDate;
          return true; // daily

        });

        if (!due.length) return Response.json({ ok: true, due: 0, emailsSent: 0 });

        const userIds = Array.from(new Set(due.map((r: Row) => r.user_id)));
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, display_name, email_reminders_enabled, unsubscribe_token")
          .in("id", userIds);
        const byId = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));

        let sent = 0;
        for (const r of due as Row[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = byId.get(r.user_id) as any;
          if (!p || !p.email_reminders_enabled) continue;
          const isHabit = r.kind === "habit";
          const res = await sendEmail({
            kind: "reminder",
            to: p.email,
            subject: `${isHabit ? "🌱" : "⏰"} ${r.title}`,
            html: emailLayout({
              title: `${isHabit ? "🌱 Tu hábito de hoy" : "⏰ Recordatorio"}`,
              body: `<p>Hola ${p.display_name || "creativa"} 💕</p><p><b>${r.title}</b></p>${
                r.message ? `<p>${r.message}</p>` : ""
              }<p>${
                isHabit
                  ? "Un día más de racha se construye en 5 minutos. ¡Tú puedes! ✨"
                  : "Márcala como hecha en IsaBot cuando la termines 🌸"
              }</p>`,
              ctaLabel: "Abrir IsaBot",
              ctaUrl: APP_URL,
              unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${p.unsubscribe_token}`,
            }),
          });
          if (res.sent) {
            sent += 1;
            const patch: Record<string, unknown> = { last_sent_at: new Date().toISOString() };
            if (r.frequency === "once") patch.active = false;
            await admin.from("user_reminders").update(patch).eq("id", r.id);
          }
        }

        return Response.json({ ok: true, due: due.length, emailsSent: sent });
      },
    },
  },
});
