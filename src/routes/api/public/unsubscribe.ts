import { createFileRoute } from "@tanstack/react-router";

function page(title: string, body: string) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:40px 20px;background:#f6eefb;font-family:system-ui,sans-serif;">
<div style="max-width:460px;margin:0 auto;background:#fff;border-radius:24px;padding:28px;text-align:center;box-shadow:0 10px 40px rgba(160,107,138,.15);">
<h1 style="color:#6b3fa0;font-size:20px;">${title}</h1><p style="color:#4b3a57;line-height:1.6;">${body}</p>
<a href="https://isa-bot.lovable.app" style="display:inline-block;margin-top:16px;padding:12px 20px;border-radius:999px;background:linear-gradient(135deg,#c9a0e8,#f0b8c8);color:#3d2450;text-decoration:none;font-weight:700;">Volver a IsaBot</a>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return page("Enlace inválido", "Falta el código de baja.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data, error } = await admin
          .from("profiles")
          .update({ email_reminders_enabled: false })
          .eq("unsubscribe_token", token)
          .select("id")
          .maybeSingle();

        if (error || !data) return page("Enlace inválido", "No encontramos esa suscripción. Puedes desactivar los correos desde Ajustes en la app.");
        return page("Listo 💕", "No volverás a recibir recordatorios por correo. Puedes reactivarlos cuando quieras desde Ajustes y Preferencias en IsaBot.");
      },
    },
  },
});
