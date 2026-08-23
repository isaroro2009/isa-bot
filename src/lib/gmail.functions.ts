import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GmailSendInput = {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  /** PDF opcional en base64 (sin prefijo data:). */
  attachmentBase64?: string;
  attachmentName?: string;
};

export type GmailSendResult = { sent: boolean; reason?: string; messageId?: string };

/** Envía un correo con la cuenta de Google conectada por la usuaria (Gmail API). */
export const sendGmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GmailSendInput) => {
    const accessToken = (input.accessToken ?? "").trim();
    const to = (input.to ?? "").trim();
    const subject = (input.subject ?? "").trim();
    const body = (input.body ?? "").trim();
    if (!accessToken) throw new Error("Falta la autorización de Google");
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(to)) throw new Error("Destinatario inválido");
    if (subject.length < 2 || subject.length > 200) throw new Error("Asunto inválido");
    if (body.length < 2 || body.length > 20000) throw new Error("Cuerpo inválido");
    const attachmentBase64 = (input.attachmentBase64 ?? "").replace(/\s+/g, "");
    if (attachmentBase64.length > 8_000_000) throw new Error("El PDF es demasiado grande");
    return {
      accessToken,
      to,
      subject,
      body,
      attachmentBase64,
      attachmentName: (input.attachmentName ?? "documento.pdf").slice(0, 80),
    };
  })
  .handler(async ({ data }): Promise<GmailSendResult> => {
    const { buildRawMessage } = await import("@/lib/gmail.server");
    const raw = buildRawMessage({
      to: data.to,
      subject: data.subject,
      body: data.body,
      attachmentBase64: data.attachmentBase64 || undefined,
      attachmentName: data.attachmentName,
    });

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) return { sent: false, reason: "gmail_unauthorized" };
      return { sent: false, reason: `gmail_error_${res.status}: ${txt.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { sent: true, messageId: json.id ?? undefined };
  });
