import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_URL = "https://isa-bot.lovable.app";

/**
 * Aviso de seguridad: te escribo cuando alguien entra a tu cuenta.
 * Se envía como máximo una vez por sesión de navegador (el cliente decide),
 * y sólo si el correo está configurado.
 */
export const sendLoginAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { device?: string }) => ({
    device: typeof input?.device === "string" ? input.device.slice(0, 160) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("email, display_name, unsubscribe_token, email_reminders_enabled")
      .eq("id", userId)
      .maybeSingle();

    if (!prof?.email) return { sent: false, reason: "no_email" };
    if (prof.email_reminders_enabled === false) return { sent: false, reason: "opted_out" };

    const { sendEmail, emailLayout, isMailConfigured } = await import("@/lib/mailer.server");
    if (!isMailConfigured()) return { sent: false, reason: "email_not_configured" };

    const when = new Date().toLocaleString("es", { dateStyle: "full", timeStyle: "short" });
    const name = prof.display_name || prof.email.split("@")[0];

    return sendEmail({
      kind: "login_alert",
      to: prof.email,
      subject: "Nuevo inicio de sesión en IsaBot 🔐",
      html: emailLayout({
        title: "Nuevo inicio de sesión 🔐",
        body:
          `<p>Hola ${name},</p>` +
          `<p>Detecté un inicio de sesión en tu cuenta de IsaBot el <b>${when}</b>` +
          (data.device ? ` desde <b>${data.device}</b>` : "") +
          `.</p><p>Si fuiste tú, todo bien 💜 Si no reconoces este acceso, cambia tu contraseña ahora mismo.</p>`,
        ctaLabel: "Revisar mi cuenta",
        ctaUrl: APP_URL,
        unsubscribeUrl: `${APP_URL}/api/public/unsubscribe?token=${prof.unsubscribe_token}`,
      }),
    });
  });
