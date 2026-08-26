// Server-only mailer. Usa Brevo (API directa) como proveedor principal:
// basta con verificar UN remitente en Brevo (sin DNS ni permisos de workspace).
// Resend queda como alternativa opcional a través del gateway de conectores.

export type MailResult = { sent: boolean; reason?: string };

const FROM_NAME = "IsaBot 💕";
const DEFAULT_FROM_EMAIL = "isaroro2021@gmail.com";

/** Dirección remitente verificada (Brevo -> Senders). */
export function fromEmail(): string {
  const raw = (process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL).trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

function fromAddress(): string {
  return `${FROM_NAME} <${fromEmail()}>`;
}

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY ||
      (process.env.RESEND_API_KEY && process.env.LOVABLE_API_KEY),
  );
}

/** Estado legible para el panel admin. */
export function mailStatus(): {
  configured: boolean;
  provider: "brevo" | "resend" | "none";
  from: string;
  reason?: string;
} {
  if (process.env.BREVO_API_KEY) {
    return { configured: true, provider: "brevo", from: fromEmail() };
  }
  if (process.env.RESEND_API_KEY && process.env.LOVABLE_API_KEY) {
    return { configured: true, provider: "resend", from: fromEmail() };
  }
  return {
    configured: false,
    provider: "none",
    from: fromEmail(),
    reason: "Falta la API key de Brevo (BREVO_API_KEY) en los secretos del proyecto.",
  };
}


/** Guarda cada intento de envío para que el panel admin pueda auditarlo. */
async function logEmail(entry: {
  to: string;
  subject: string;
  kind: string;
  html: string;
  result: MailResult;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("email_log").insert({
      recipient: entry.to,
      subject: entry.subject,
      kind: entry.kind,
      status: entry.result.sent ? "sent" : "failed",
      reason: entry.result.reason ?? null,
      html: entry.html.slice(0, 60000),
    });
  } catch (e) {
    console.error("[mailer] no se pudo registrar el correo", e);
  }
}

export type MailAttachment = { name: string; base64: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  kind?: string;
  attachments?: MailAttachment[];
}): Promise<MailResult> {
  const result = await deliver(opts);
  await logEmail({
    to: opts.to,
    subject: opts.subject,
    kind: opts.kind ?? "other",
    html: opts.html,
    result,
  });
  return result;
}

async function deliver(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<MailResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;

  if (!opts.to || !opts.to.includes("@")) return { sent: false, reason: "invalid_recipient" };

  try {
    // 1) Brevo API directa: solo necesita la API key y un remitente verificado.
    if (brevoKey) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: fromEmail() },
          replyTo: { name: FROM_NAME, email: fromEmail() },
          to: [{ email: opts.to }],
          subject: opts.subject,
          htmlContent: opts.html,
          ...(opts.attachments?.length
            ? { attachment: opts.attachments.map((a) => ({ name: a.name, content: a.base64 })) }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[mailer] brevo failed [${res.status}]: ${body}`);
        if (/unrecognised IP|unrecognized IP|authorised_ips/i.test(body)) {
          return {
            sent: false,
            reason:
              "brevo_ip_no_autorizada: Brevo bloquea los envíos porque la IP del servidor no está autorizada. Entra a Brevo → Seguridad → IPs autorizadas y desactiva la restricción de IP (o marca «permitir todas»).",
          };
        }
        if (res.status === 400 && /sender|not valid|not verified/i.test(body)) {
          return {
            sent: false,
            reason: `brevo_remitente_no_verificado: verifica ${fromEmail()} en Brevo → Senders.`,
          };
        }
        return { sent: false, reason: `brevo_${res.status}: ${body.slice(0, 300)}` };
      }
      return { sent: true };
    }

    // 2) Resend (opcional) vía gateway de conectores.
    if (lovableKey && resendKey) {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[mailer] resend failed [${res.status}]: ${body}`);
        return { sent: false, reason: `resend_${res.status}: ${body.slice(0, 300)}` };
      }
      return { sent: true };
    }

  } catch (e) {
    console.error("[mailer] unexpected error", e);
    return { sent: false, reason: "network_error" };
  }

  console.warn(`[mailer] email not configured — skipped "${opts.subject}" to ${opts.to}`);
  return { sent: false, reason: "email_not_configured" };
}

export function emailLayout(opts: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6eefb;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px;box-shadow:0 10px 40px rgba(160,107,138,0.15);">
    <div style="font-size:13px;font-weight:700;color:#a06b8a;letter-spacing:.5px;">ISABOT · ISARORO STUDIO</div>
    <h1 style="margin:10px 0 14px;font-size:22px;color:#6b3fa0;">${opts.title}</h1>
    <div style="font-size:15px;line-height:1.7;color:#4b3a57;">${opts.body}</div>
    ${
      opts.ctaUrl
        ? `<p style="margin:24px 0 0;"><a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:linear-gradient(135deg,#c9a0e8,#f0b8c8);color:#3d2450;text-decoration:none;font-weight:700;">${opts.ctaLabel ?? "Abrir IsaBot"}</a></p>`
        : ""
    }
  </div>
  ${
    opts.unsubscribeUrl
      ? `<p style="max-width:520px;margin:14px auto 0;font-size:11px;color:#a08bb0;text-align:center;">Si no quieres más recordatorios, <a href="${opts.unsubscribeUrl}" style="color:#a08bb0;">date de baja aquí</a>.</p>`
      : ""
  }
</body></html>`;
}
