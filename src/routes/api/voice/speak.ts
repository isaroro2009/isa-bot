import { createFileRoute } from "@tanstack/react-router";

// Convierte texto a voz con Lovable AI Gateway (OpenAI TTS).
// Devuelve audio MP3. Requiere sesión autenticada.
export const Route = createFileRoute("/api/voice/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) return new Response("unauthorized", { status: 401 });

          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!supaUrl || !supaKey || !lovableKey) {
            return new Response("server_misconfigured", { status: 500 });
          }

          const { createClient } = await import("@supabase/supabase-js");
          const supa = createClient(supaUrl, supaKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userData, error: userErr } = await supa.auth.getUser(token);
          if (userErr || !userData?.user) return new Response("unauthorized", { status: 401 });

          const body = (await request.json()) as { text?: string; voice?: string };
          const text = (body.text ?? "").toString().trim().slice(0, 4000);
          if (!text) return new Response("empty", { status: 400 });
          const voice = body.voice && typeof body.voice === "string" ? body.voice : "shimmer";

          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              voice,
              response_format: "mp3",
            }),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            console.error("TTS gateway error:", res.status, errTxt);
            return new Response("tts_failed", { status: 502 });
          }
          const audio = await res.arrayBuffer();
          return new Response(audio, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          console.error("speak error:", err);
          return new Response("internal", { status: 500 });
        }
      },
    },
  },
});
