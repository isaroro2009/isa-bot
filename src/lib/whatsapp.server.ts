// 🤖 Cerebro de IsaBot para WhatsApp (solo servidor).
// Genera la respuesta y la envía por WhatsApp Cloud API o Evolution API.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT =
  "Eres IsaBot, la asistente creativa de IsaRoRo Studio. Respondes por WhatsApp: mensajes cortos (máx. 4 líneas), cálidos, en el idioma de la persona, con algún emoji. Si te piden algo largo (PDF, diseño, clases) invita a abrir la app de IsaBot.";

/** Genera la respuesta de IsaBot con la clave propia (Groq) o Gemini. */
export async function isabotReply(text: string): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: "openai/gpt-oss-20b", messages, temperature: 0.3 }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const out = j.choices?.[0]?.message?.content?.trim();
        if (out) return out;
      }
    } catch {
      /* seguimos con Gemini */
    }
  }

  const googleKey = process.env["GOOGLE_AI_API_KEY"];
  if (googleKey) {
    try {
      const res = await fetch(`${GEMINI_URL}/gemini-flash-latest:generateContent?key=${googleKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text }] }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const out = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (out) return out;
      }
    } catch {
      /* sin motor disponible */
    }
  }

  return "¡Hola! Soy IsaBot 💜 Ahora mismo no puedo pensar bien, inténtalo en un momentito o entra a la app.";
}

/** Envía un mensaje de texto por WhatsApp (Cloud API o Evolution API). */
export async function sendWhatsAppText(to: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  const cloudToken = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_ID"];
  if (cloudToken && phoneId) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cloudToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `cloud_${res.status}` };
  }

  const evoUrl = process.env["EVOLUTION_API_URL"];
  const evoKey = process.env["EVOLUTION_API_KEY"];
  const evoInstance = process.env["EVOLUTION_INSTANCE"];
  if (evoUrl && evoKey && evoInstance) {
    const res = await fetch(`${evoUrl.replace(/\/$/, "")}/message/sendText/${evoInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number: to, text: body }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `evolution_${res.status}` };
  }

  return { ok: false, reason: "whatsapp_not_configured" };
}

/** Extrae { from, text } de un payload de Cloud API o Evolution API. */
export function parseIncoming(payload: unknown): { from: string; text: string } | null {
  const p = payload as Record<string, unknown>;

  // WhatsApp Cloud API
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (p as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.from && msg?.text?.body) return { from: String(msg.from), text: String(msg.text.body) };
  } catch {
    /* no es Cloud API */
  }

  // Evolution API
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (p as any)?.data ?? p;
    const jid: string | undefined = d?.key?.remoteJid;
    const text: string | undefined =
      d?.message?.conversation ?? d?.message?.extendedTextMessage?.text;
    if (jid && text && !d?.key?.fromMe) return { from: jid.split("@")[0], text: String(text) };
  } catch {
    /* payload desconocido */
  }

  return null;
}
