import { createServerFn } from "@tanstack/react-start";

export type WebhookEmailInput = {
  recipient: string;
  subject: string;
  body_text: string;
  /** PDF en base64 (sin prefijo data:), opcional. */
  pdf_data?: string;
  pdf_name?: string;
};

/**
 * 📮 Envía la petición de correo/PDF a un Webhook configurable
 * (n8n, Make, Zapier, edge function...). Sin OAuth ni APIs de Google.
 */
export const sendEmailWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: WebhookEmailInput) => input)
  .handler(async ({ data }) => {
    const url = process.env["EMAIL_WEBHOOK_URL"];

    // 🚀 Sin webhook: enviamos directo con el mailer del servidor (sin OAuth ni logins).
    if (!url) {
      const { sendEmail } = await import("@/lib/mailer.server");
      const res = await sendEmail({
        to: data.recipient,
        subject: data.subject,
        kind: "agent",
        html: `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif;line-height:1.6;">${data.body_text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</div>`,
        attachments: data.pdf_data
          ? [{ name: data.pdf_name ?? "isabot.pdf", base64: data.pdf_data }]
          : undefined,
      });
      return res.sent
        ? { ok: true as const }
        : { ok: false as const, reason: res.reason ?? "email_not_configured" };
    }


    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env["EMAIL_WEBHOOK_SECRET"]
            ? { "X-Webhook-Secret": process.env["EMAIL_WEBHOOK_SECRET"] }
            : {}),
        },
        body: JSON.stringify({
          recipient: data.recipient,
          subject: data.subject,
          body_text: data.body_text,
          pdf_data: data.pdf_data ?? null,
          pdf_name: data.pdf_name ?? null,
          source: "isabot",
          sent_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) return { ok: false as const, reason: `webhook_${res.status}` };
      return { ok: true as const };
    } catch {
      return { ok: false as const, reason: "webhook_unreachable" };
    }
  });
