import { createFileRoute } from "@tanstack/react-router";

// 🌙 Corre cada noche: prospección automática de todas las campañas activas.
export const Route = createFileRoute("/api/public/hooks/night-sales")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "") ??
          "";
        const allowed = [
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.VITE_SUPABASE_ANON_KEY,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ].filter((v): v is string => Boolean(v) && v!.length > 20);
        if (!token || !allowed.includes(token)) {
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
