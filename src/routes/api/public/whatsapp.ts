import { createFileRoute } from "@tanstack/react-router";

/** Comparación en tiempo constante para tokens. */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      // 🔐 Verificación del webhook (WhatsApp Cloud API)
      GET: async ({ request }) => {
        const verify = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "";
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (verify.length >= 12 && mode === "subscribe" && safeEqual(verify, token)) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      // 💬 Mensajes entrantes → respuesta de IsaBot
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_WEBHOOK_SECRET"];
        if (secret) {
          const provided =
            request.headers.get("x-webhook-secret") ?? request.headers.get("apikey") ?? "";
          if (!provided || !safeEqual(secret, provided)) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { parseIncoming, parseGreenIncoming, isabotReply, sendWhatsAppText } = await import(
          "@/lib/whatsapp.server"
        );
        const green = parseGreenIncoming(payload);
        const incoming = green
          ? { from: green.chatId, text: green.text }
          : parseIncoming(payload);
        // Siempre 200 para que WhatsApp no reintente eventos de estado.
        if (!incoming) return Response.json({ ok: true, ignored: true });

        const text = incoming.text.slice(0, 2000);
        try {
          const reply = await isabotReply(text);
          const sent = await sendWhatsAppText(incoming.from, reply);
          return Response.json({ ok: true, sent: sent.ok, reason: sent.reason ?? null });
        } catch (e) {
          console.error("[whatsapp webhook]", e);
          return Response.json({ ok: false, error: "processing_error" }, { status: 500 });
        }
      },
    },
  },
});
