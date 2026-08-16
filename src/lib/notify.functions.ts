import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Utilidad de envío de correos aprobados por la usuaria desde el chat.
 * El HTML se construye en el servidor: el cliente solo manda texto plano.
 */
export const sendEmailNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; subject: string; body: string }) => {
    const to = (input.to ?? "").trim();
    const subject = (input.subject ?? "").trim();
    const body = (input.body ?? "").trim();
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(to)) throw new Error("Destinatario inválido");
    if (subject.length < 2 || subject.length > 160) throw new Error("Asunto inválido");
    if (body.length < 2 || body.length > 4000) throw new Error("Cuerpo inválido");
    return { to, subject, body };
  })
  .handler(async ({ data, context }): Promise<{ sent: boolean; reason?: string }> => {
    const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
    const { checkEmailQuota, recordEmailSent, EMAIL_DAILY_LIMIT } = await import(
      "@/lib/email-quota.server"
    );

    // Anti-abuso: tope diario de envíos por usuaria.
    const quota = await checkEmailQuota(context.userId);
    if (!quota.allowed) {
      return {
        sent: false,
        reason: `limite_diario: puedes enviar máximo ${EMAIL_DAILY_LIMIT} correos por día.`,
      };
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const from = profile?.display_name || profile?.email || "una usuaria de IsaBot";
    const html = emailLayout({
      title: data.subject,
      body: `${data.body
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>").replace(/</g, "&lt;")}</p>`)
        .join("")}<p style="font-size:12px;color:#a08bb0;">Enviado por ${from} con ayuda de IsaBot 💕</p>`,
      ctaLabel: "Conocer IsaBot",
      ctaUrl: "https://isa-bot.lovable.app",
    });

    const res = await sendEmail({ kind: "agent", to: data.to, subject: data.subject, html });
    if (res.sent) await recordEmailSent(context.userId, data.to);
    return { sent: res.sent, reason: res.sent ? undefined : (res.reason ?? "unknown") };
  });

