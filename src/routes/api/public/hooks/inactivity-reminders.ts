import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://isa-bot.lovable.app";
const INACTIVE_DAYS = 8;
const COOLDOWN_DAYS = 7;

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

export const Route = createFileRoute("/api/public/hooks/inactivity-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const now = Date.now();
        const inactiveBefore = new Date(now - INACTIVE_DAYS * 86400000).toISOString();
        const cooldownBefore = new Date(now - COOLDOWN_DAYS * 86400000).toISOString();

        const { data: people, error } = await admin
          .from("profiles")
          .select("id, email, display_name, last_seen_at, last_inactivity_email_at, unsubscribe_token")
          .eq("email_reminders_enabled", true)
          .eq("inactivity_emails_enabled", true)
          .not("last_seen_at", "is", null)
          .lt("last_seen_at", inactiveBefore)
          .limit(200);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let sent = 0;
        for (const p of people ?? []) {
          if (p.last_inactivity_email_at && p.last_inactivity_email_at > cooldownBefore) continue;
          const days = Math.floor((now - new Date(p.last_seen_at).getTime()) / 86400000);
          const res = await sendEmail({
            kind: "inactivity",
            to: p.email,
            subject: "Te extraño 💕 ¿Retomamos hoy?",
            html: emailLayout({
              title: "Te extraño 💕",
              body: `<p>Hola ${p.display_name || "creativa"},</p><p>Hace <b>${days} días</b> que no pasas por IsaBot. Volvamos con algo suave: elige una tarea pequeña, activa el Pomodoro y en 25 minutos ya estás de vuelta ✨</p><p>Te espero con tus chats, tus notas y tus IsaBot Coins intactos 🌟</p>`,
              ctaLabel: "Volver a IsaBot",
              ctaUrl: APP_URL,
              unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${p.unsubscribe_token}`,
            }),
          });
          if (res.sent) {
            sent += 1;
            await admin
              .from("profiles")
              .update({ last_inactivity_email_at: new Date().toISOString() })
              .eq("id", p.id);
          }
        }

        return Response.json({ ok: true, candidates: people?.length ?? 0, emailsSent: sent });
      },
    },
  },
});
