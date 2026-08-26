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

/** 🎂 Felicitaciones de cumpleaños (una vez al año por persona). */
export const Route = createFileRoute("/api/public/hooks/birthday-greetings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const today = new Date();
        const mmdd = `${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
        const year = today.getUTCFullYear();

        const { data: people, error } = await admin
          .from("profiles")
          .select("id, email, display_name, birthday, last_birthday_email_year, unsubscribe_token")
          .eq("email_reminders_enabled", true)
          .not("birthday", "is", null)
          .limit(500);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let sent = 0;
        for (const p of people ?? []) {
          if (String(p.birthday).slice(5) !== mmdd) continue;
          if (p.last_birthday_email_year === year) continue;
          const res = await sendEmail({
            kind: "birthday",
            to: p.email,
            subject: "🎂 ¡Feliz cumpleaños! Tengo un regalo para ti",
            html: emailLayout({
              title: "🎂 ¡Feliz cumple!",
              body: `<p>¡Feliz cumpleaños, ${p.display_name || "creativa"}! 🎉</p><p>Hoy te celebro con <b>+25 IsaBot Coins</b> de regalo en tu bóveda. Úsalos para crear ese documento, esa imagen o ese plan que tenías pendiente 💜</p>`,
              ctaLabel: "Reclamar mi regalo",
              ctaUrl: APP_URL,
              unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${p.unsubscribe_token}`,
            }),
          });
          if (res.sent) {
            sent += 1;
            await admin.rpc("ibc_admin_grant", { _user_id: p.id, _amount: 25, _reason: "Regalo de cumpleaños 🎂" });
            await admin.from("profiles").update({ last_birthday_email_year: year }).eq("id", p.id);
          }
        }

        return Response.json({ ok: true, emailsSent: sent });
      },
    },
  },
});
