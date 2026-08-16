// Plantilla reutilizable del correo de bienvenida (server-only).
import { emailLayout } from "@/lib/mailer.server";

export const WELCOME_SUBJECT = "💜 Bienvenida/o a IsaBot";

export function buildWelcomeEmail(opts: {
  name: string;
  referralCode?: string | null;
}): { subject: string; html: string } {
  const code = opts.referralCode ?? "";
  const appUrl = "https://isa-bot.lovable.app";
  const inviteUrl = code ? `${appUrl}/i/${code}` : appUrl;

  const html = emailLayout({
    title: `¡Bienvenida/o a IsaBot, ${opts.name}! 💜`,
    body: `
      <p>Soy <strong>IsaBot</strong>, tu co-piloto de IA creativa hecho por Isabella Rodríguez Roque (IsaRoRo Studio).
      Ya puedes chatear conmigo, generar imágenes, llamarme por voz, planear tu día y mucho más.</p>

      <h2 style="font-size:16px;color:#6b3fa0;margin:22px 0 8px;">✨ Con el plan Pro desbloqueas</h2>
      <ul style="padding-left:18px;margin:0;">
        <li>🧠 <strong>Modo Crack</strong> y análisis profundo de tus ideas y proyectos</li>
        <li>⏱️ <strong>Pomodoro y Modo Foco</strong> ajustables</li>
        <li>🗓️ <strong>Planner mensual</strong> digital y personalizado</li>
        <li>🎁 <strong>Regalo semanal</strong> exclusivo de diseño</li>
        <li>🎭 <strong>Modos de personalidad</strong> extra y estilos a tu medida</li>
        <li>📄 Exportar tus resultados en PDF</li>
      </ul>

      <h2 style="font-size:16px;color:#6b3fa0;margin:22px 0 8px;">💌 Invita y gana</h2>
      <ul style="padding-left:18px;margin:0;">
        <li><strong>+25 IsaPuntos</strong> por cada amiga/o que se une con tu código</li>
        <li>Tu invitada/o recibe <strong>+15 IsaPuntos</strong> de bienvenida</li>
        <li>Cada <strong>3 invitadas/os activas/os = 7 días Pro gratis</strong> para ti</li>
      </ul>
      ${code ? `<p style="margin-top:14px;">Tu código: <strong style="font-size:18px;letter-spacing:1px;">${code}</strong><br/>
      Tu link: <a href="${inviteUrl}" style="color:#a06b8a;">${inviteUrl}</a></p>` : ""}
    `,
    ctaLabel: "Empezar con IsaBot ✨",
    ctaUrl: appUrl,
  });

  return { subject: WELCOME_SUBJECT, html };
}
