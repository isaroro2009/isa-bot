import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Envía (una sola vez) el correo de bienvenida a un usuario nuevo,
 * recordándole los beneficios del plan Pro y el programa de referidos.
 */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("email, display_name, referral_code, welcome_email_sent_at")
      .eq("id", userId)
      .maybeSingle();

    if (!prof?.email) return { sent: false, reason: "no_email" };
    if (prof.welcome_email_sent_at) return { sent: false, reason: "already_sent" };

    const { sendEmail, isMailConfigured } = await import("@/lib/mailer.server");
    const { buildWelcomeEmail } = await import("@/lib/welcome-email.server");
    if (!isMailConfigured()) return { sent: false, reason: "email_not_configured" };

    const name = prof.display_name || prof.email.split("@")[0];
    const { subject, html } = buildWelcomeEmail({ name, referralCode: prof.referral_code });

    const res = await sendEmail({ to: prof.email, subject, html, kind: "welcome" });
    if (res.sent) {
      await supabase
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", userId);
    }
    return res;
  });
