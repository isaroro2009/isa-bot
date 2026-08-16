import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  // Secreto exclusivo del servidor. NUNCA usar la publishable/anon key: es pública.
  const key = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-key") ?? "";
  if (!key || key.length < 16 || !provided) return false;
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/tech-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { refreshTechNews } = await import("@/lib/techNews.server");
        try {
          const res = await refreshTechNews();
          return Response.json({ ok: true, ...res });
        } catch (e) {
          console.error("[tech-news hook]", e);
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
