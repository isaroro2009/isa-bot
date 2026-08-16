import { createFileRoute } from "@tanstack/react-router";

// Analiza un frame de la cámara y devuelve la emoción detectada.
// Usa google/gemini-3-pro-image (multimodal) vía Lovable AI Gateway.
// Requiere sesión Supabase autenticada.
export const Route = createFileRoute("/api/voice/vision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!supaUrl || !supaKey || !lovableKey) {
            return Response.json({ error: "server_misconfigured" }, { status: 500 });
          }

          const { createClient } = await import("@supabase/supabase-js");
          const supa = createClient(supaUrl, supaKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userData, error: userErr } = await supa.auth.getUser(token);
          if (userErr || !userData?.user) {
            return Response.json({ error: "unauthorized" }, { status: 401 });
          }

          const body = (await request.json()) as { image?: string };
          const image = (body.image ?? "").toString();
          if (!image.startsWith("data:image/")) {
            return Response.json({ error: "missing_image" }, { status: 400 });
          }
          if (image.length > 2_000_000) {
            return Response.json({ error: "image_too_large" }, { status: 413 });
          }

          const prompt =
            'Observa esta imagen de una persona y detecta su emoción principal. Responde SOLO con JSON válido (sin markdown, sin texto extra) con este formato exacto: {"emotion":"happy|sad|neutral|worried|excited|sleepy|angry|love","confidence":0.0-1.0,"note":"nota corta en español, máx 8 palabras"}. Si no ves cara humana claramente, devuelve {"emotion":"neutral","confidence":0.2,"note":"no veo bien"}.';

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: image } },
                  ],
                },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            console.error("vision gateway error:", res.status, errTxt);
            return Response.json({ error: "vision_failed", status: res.status }, { status: 502 });
          }
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = (data.choices?.[0]?.message?.content ?? "").trim();
          let parsed: { emotion?: string; confidence?: number; note?: string } = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) {
              try {
                parsed = JSON.parse(m[0]);
              } catch {
                /* ignore */
              }
            }
          }
          const validEmotions = new Set([
            "happy",
            "sad",
            "neutral",
            "worried",
            "excited",
            "sleepy",
            "angry",
            "love",
          ]);
          const emotion =
            typeof parsed.emotion === "string" && validEmotions.has(parsed.emotion)
              ? parsed.emotion
              : "neutral";
          const confidence =
            typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
              ? parsed.confidence
              : 0.5;
          const note =
            typeof parsed.note === "string" ? parsed.note.slice(0, 80) : "";

          return Response.json({ emotion, confidence, note });
        } catch (err) {
          console.error("vision handler error:", err);
          return Response.json({ error: "internal" }, { status: 500 });
        }
      },
    },
  },
});
