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
    if (!url) return { ok: false as const, reason: "webhook_not_configured" };

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
