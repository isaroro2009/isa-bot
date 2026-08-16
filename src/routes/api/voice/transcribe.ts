import { createFileRoute } from "@tanstack/react-router";

// Transcribes audio (WAV/webm/mp4) to text using Lovable AI Gateway.
// Requires an authenticated Supabase session (bearer token) — evita abuso.
export const Route = createFileRoute("/api/voice/transcribe")({
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

          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof Blob)) {
            return Response.json({ error: "missing_file" }, { status: 400 });
          }
          if (file.size < 800) {
            return Response.json({ text: "" });
          }
          if (file.size > 20 * 1024 * 1024) {
            return Response.json({ error: "file_too_large" }, { status: 413 });
          }

          const upstream = new FormData();
          // Modelo full para mejor precisión en español conversacional.
          upstream.append("model", "openai/gpt-4o-transcribe");
          upstream.append("language", "es");
          upstream.append(
            "prompt",
            "Conversación casual en español con IsaBot, una asistente virtual creada por Isabella Rodríguez Roque.",
          );
          const name = (file as File).name || "recording.wav";
          upstream.append("file", file, name);

          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableKey}` },
            body: upstream,
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            console.error("STT gateway error:", res.status, errTxt);
            return Response.json({ error: "transcription_failed", status: res.status }, { status: 502 });
          }
          const data = (await res.json()) as { text?: string };
          return Response.json({ text: (data.text ?? "").trim() });
        } catch (err) {
          console.error("transcribe error:", err);
          return Response.json({ error: "internal" }, { status: 500 });
        }
      },
    },
  },
});
