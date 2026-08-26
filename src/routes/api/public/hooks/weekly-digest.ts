import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://isa-bot.lovable.app";

function authorized(request: Request): boolean {
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

/** 📰 Hola semanal: resumen y motivación cada lunes. */
export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const cooldown = new Date(Date.now() - 6 * 86400000).toISOString();

        const { data: people, error } = await admin
          .from("profiles")
          .select("id, email, display_name, last_weekly_digest_at, unsubscribe_token")
          .eq("email_reminders_enabled", true)
          .limit(500);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let sent = 0;
        for (const p of people ?? []) {
          if (p.last_weekly_digest_at && p.last_weekly_digest_at > cooldown) continue;

          const { data: wallet } = await admin
            .from("ibc_wallets")
            .select("balance, streak_days")
            .eq("user_id", p.id)
            .maybeSingle();

          const res = await sendEmail({
            kind: "weekly_digest",
            to: p.email,
            subject: "✨ Tu semana con IsaBot empieza aquí",
            html: emailLayout({
              title: "✨ ¡Hola! Nueva semana, nuevas ideas",
              body: `<p>Hola ${p.display_name || "creativa"} 💜</p>
<p>Tienes <b>${wallet?.balance ?? 0} IsaBot Coins</b> y una racha de <b>${wallet?.streak_days ?? 0} día(s)</b>.</p>
<p>Tres ideas para esta semana:</p>
<ul>
  <li>📄 Pídeme un documento o planner en PDF y descárgalo al instante.</li>
  <li>🎨 Genera una imagen para tu próximo post.</li>
  <li>⏰ Arma tu plan del día y activa el Pomodoro.</li>
</ul>`,
              ctaLabel: "Abrir IsaBot",
              ctaUrl: APP_URL,
              unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${p.unsubscribe_token}`,
            }),
          });
          if (res.sent) {
            sent += 1;
            await admin
              .from("profiles")
              .update({ last_weekly_digest_at: new Date().toISOString() })
              .eq("id", p.id);
          }
        }

        return Response.json({ ok: true, emailsSent: sent });
      },
    },
  },
});
