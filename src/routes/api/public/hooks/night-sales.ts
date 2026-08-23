import { createFileRoute } from "@tanstack/react-router";

// 🌙 Corre cada noche: prospección automática de todas las campañas activas.
export const Route = createFileRoute("/api/public/hooks/night-sales")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Secreto exclusivo del servidor. NUNCA la publishable/anon key: es pública.
        const secret = process.env.CRON_SECRET ?? "";
        const provided = request.headers.get("x-cron-key") ?? "";
        const a = new TextEncoder().encode(secret);
        const b = new TextEncoder().encode(provided);
        let ok = secret.length >= 16 && provided.length > 0 && a.length === b.length;
        if (ok) {
          let diff = 0;
          for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
          ok = diff === 0;
        }
        if (!ok) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }



        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCampaign } = await import("@/lib/salesRun.server");

        const { data: campaigns } = await supabaseAdmin
          .from("sales_campaigns")
          .select("id, user_id, name, niche, city, offer, channels, daily_limit, auto_send")
          .eq("active", true)
          .limit(50);

        const results = [];
        for (const c of campaigns ?? []) {
          try {
            results.push(await runCampaign(supabaseAdmin, c));
          } catch (e) {
            results.push({ campaign: c.name, error: String(e) });
          }
        }

        return Response.json({ ok: true, ran: results.length, results });
      },
    },
  },
});
