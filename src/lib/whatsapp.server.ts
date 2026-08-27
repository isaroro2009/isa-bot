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

export type EvolutionConfig = { url: string; key: string; instance: string };

export type GreenConfig = { idInstance: string; apiToken: string };

/** Lee las credenciales de Green API (panel primero, luego variables de entorno). */
export async function readGreenConfig(): Promise<GreenConfig> {
  const cfg: GreenConfig = {
    idInstance: process.env["GREEN_API_ID_INSTANCE"] ?? "",
    apiToken: process.env["GREEN_API_TOKEN_INSTANCE"] ?? "",
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("integration_settings")
      .select("key, value")
      .in("key", ["GREEN_API_ID_INSTANCE", "GREEN_API_TOKEN_INSTANCE"]);
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      if (row.key === "GREEN_API_ID_INSTANCE") cfg.idInstance = row.value.trim();
      if (row.key === "GREEN_API_TOKEN_INSTANCE") cfg.apiToken = row.value.trim();
    }
  } catch {
    /* sin base de datos */
  }
  return cfg;
}

function greenBase(cfg: GreenConfig): string {
  return `https://api.green-api.com/waInstance${cfg.idInstance}`;
}

/** Estado de la instancia de Green API (authorized = WhatsApp conectado). */
export async function greenStatus(
  cfg: GreenConfig,
): Promise<{ state: string | null; connected: boolean; error: string | null }> {
  if (!cfg.idInstance || !cfg.apiToken)
    return { state: null, connected: false, error: "missing_credentials" };
  try {
    const res = await fetch(`${greenBase(cfg)}/getStateInstance/${cfg.apiToken}`);
    const j: any = await res.json().catch(() => ({}));
    const state = j?.stateInstance ?? null;
    return { state, connected: state === "authorized", error: res.ok ? null : `http_${res.status}` };
  } catch (e) {
    return { state: null, connected: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Envía un mensaje de texto por Green API. */
export async function sendGreenText(
  cfg: GreenConfig,
  chatId: string,
  message: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(`${greenBase(cfg)}/sendMessage/${cfg.apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `green_${res.status}` };
  } catch {
    return { ok: false, reason: "green_network_error" };
  }
}

/** Extrae { chatId, text } de un webhook de Green API (incomingMessageReceived). */
export function parseGreenIncoming(payload: unknown): { chatId: string; text: string } | null {
  const p = payload as any;
  if (!p || p.typeWebhook !== "incomingMessageReceived") return null;
  const chatId: string | undefined = p?.senderData?.chatId;
  if (!chatId || String(chatId).endsWith("@g.us")) return null;
  const md = p?.messageData ?? {};
  const text: string | undefined =
    md?.textMessageData?.textMessage ??
    md?.extendedTextMessageData?.text ??
    md?.extendedTextMessageData?.description ??
    md?.imageMessageData?.caption;
  if (!text) return null;
  return { chatId: String(chatId), text: String(text) };
}

/** Lee la config de Evolution API: primero la guardada en el panel, luego las variables de entorno. */
export async function readWhatsAppConfig(): Promise<EvolutionConfig> {
  const cfg: EvolutionConfig = {
    url: (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, ""),
    key: process.env["EVOLUTION_API_KEY"] ?? "",
    instance: process.env["EVOLUTION_INSTANCE"] ?? "isabot",
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("integration_settings")
      .select("key, value")
      .in("key", ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"]);
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      if (row.key === "EVOLUTION_API_URL") cfg.url = row.value.replace(/\/$/, "");
      if (row.key === "EVOLUTION_API_KEY") cfg.key = row.value;
      if (row.key === "EVOLUTION_INSTANCE") cfg.instance = row.value;
    }
  } catch {
    /* sin base de datos: usamos las variables de entorno */
  }
  return cfg;
}

type QrResult = { qr: string | null; state: string | null; error: string | null; connected: boolean };

function pickQr(j: any): string | null {
  return (
    j?.base64 ?? j?.qrcode?.base64 ?? j?.qrcode?.code ?? j?.code ?? j?.qr ?? null
  );
}

/** Estado actual de la sesión (open = WhatsApp conectado). */
export async function evolutionStatus(cfg: EvolutionConfig): Promise<QrResult> {
  if (!cfg.url || !cfg.key)
    return { qr: null, state: null, connected: false, error: "missing_credentials" };
  try {
    const res = await fetch(`${cfg.url}/instance/connectionState/${cfg.instance}`, {
      headers: { apikey: cfg.key },
    });
    const j: any = await res.json().catch(() => ({}));
    const state = j?.instance?.state ?? j?.state ?? null;
    return { qr: null, state, connected: state === "open", error: res.ok ? null : `http_${res.status}` };
  } catch (e) {
    return { qr: null, state: null, connected: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Crea la instancia si hace falta y devuelve el QR para escanear. */
export async function evolutionConnect(cfg: EvolutionConfig): Promise<QrResult> {
  if (!cfg.url || !cfg.key)
    return { qr: null, state: null, connected: false, error: "missing_credentials" };
  const headers = { "Content-Type": "application/json", apikey: cfg.key };
  try {
    // Crea la instancia (si ya existe, la API devuelve 403/409 y seguimos).
    await fetch(`${cfg.url}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({ instanceName: cfg.instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    }).catch(() => null);

    const res = await fetch(`${cfg.url}/instance/connect/${cfg.instance}`, { headers: { apikey: cfg.key } });
    const j: any = await res.json().catch(() => ({}));
    const qr = pickQr(j);
    const state = j?.instance?.state ?? j?.state ?? null;
    return {
      qr,
      state,
      connected: state === "open",
      error: qr || state ? null : `http_${res.status}`,
    };
  } catch (e) {
    return { qr: null, state: null, connected: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Envía un mensaje de texto por WhatsApp usando Evolution API. */
export async function sendWhatsAppText(to: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  // Green API tiene prioridad si está configurada.
  const green = await readGreenConfig();
  if (green.idInstance && green.apiToken) {
    const chatId = to.includes("@") ? to : `${to.replace(/\D/g, "")}@c.us`;
    return sendGreenText(green, chatId, body);
  }

  const cfg = await readWhatsAppConfig();
  if (cfg.url && cfg.key && cfg.instance) {
    try {
      const res = await fetch(`${cfg.url}/message/sendText/${cfg.instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.key },
        body: JSON.stringify({ number: to, text: body, textMessage: { text: body } }),
      });
      return res.ok ? { ok: true } : { ok: false, reason: `evolution_${res.status}` };
    } catch {
      return { ok: false, reason: "evolution_network_error" };
    }
  }

  // Compatibilidad opcional con Meta Cloud API si alguien aún tiene esas variables.
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

  return { ok: false, reason: "whatsapp_not_configured" };
}

/** Extrae { from, text } de eventos de Evolution API (MESSAGES_UPSERT / SEND_MESSAGE) o Cloud API. */
export function parseIncoming(payload: unknown): { from: string; text: string } | null {
  const p = payload as any;

  // Evolution API
  try {
    const event = String(p?.event ?? "").toUpperCase().replace(/\./g, "_");
    const raw = p?.data ?? p;
    const d = Array.isArray(raw) ? raw[0] : raw;
    const jid: string | undefined = d?.key?.remoteJid ?? d?.remoteJid;
    const m = d?.message ?? {};
    const text: string | undefined =
      m?.conversation ??
      m?.extendedTextMessage?.text ??
      m?.imageMessage?.caption ??
      m?.videoMessage?.caption ??
      m?.ephemeralMessage?.message?.conversation ??
      d?.text;
    const fromMe = Boolean(d?.key?.fromMe);
    const isGroup = typeof jid === "string" && jid.endsWith("@g.us");
    const okEvent = !event || event === "MESSAGES_UPSERT" || event === "SEND_MESSAGE" || event.startsWith("MESSAGES");
    if (okEvent && jid && text && !fromMe && !isGroup) {
      return { from: String(jid).split("@")[0]!, text: String(text) };
    }
  } catch {
    /* no es Evolution */
  }

  // WhatsApp Cloud API (compatibilidad)
  try {
    const msg = p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.from && msg?.text?.body) return { from: String(msg.from), text: String(msg.text.body) };
  } catch {
    /* payload desconocido */
  }

  return null;
}

