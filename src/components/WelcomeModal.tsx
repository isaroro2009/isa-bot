import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bienvenida dentro de la app (no necesita correo ni APIs).
 * Se muestra cada vez que la usuaria entra a la app web.
 */
export default function WelcomeModal({ userId, name }: { userId: string; name?: string | null }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // Una vez por entrada a la app (se limpia al cerrar la pestaña/app).
    const key = `isabot_welcome_session_${userId}`;
    if (window.sessionStorage.getItem(key)) return;
    setOpen(true);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) setCode((data?.referral_code as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function close() {
    window.sessionStorage.setItem(`isabot_welcome_session_${userId}`, "1");
    setOpen(false);
  }


  if (!open) return null;

  const link = code ? `${window.location.origin}/?ref=${code}` : "";

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="Bienvenida a IsaBot">
      <div className="welcome-card">
        <div className="welcome-emoji">💜</div>
        <h2>¡Hola{name ? `, ${name}` : ""}! Esto es IsaBot ✨</h2>
        <p className="welcome-sub">
          No soy solo un chat: soy tu copiloto creativo con IA, hecho por Isabella Rodríguez Roque.
          Escribe una idea y en segundos la convierto en algo real 💫
        </p>

        <ul className="welcome-list">
          <li>💬 Chatea con IA multimodal: textos, ideas, resúmenes y análisis</li>
          <li>🎨 Genera imágenes y arte desde una frase</li>
          <li>📄 Documentos y planners profesionales en PDF, listos para descargar</li>
          <li>💌 Correos redactados y enviados por ti, sin configurar nada</li>
          <li>⏰ Recordatorios, plan del día y Pomodoro para no perder el foco</li>
          <li>🎓 IsaAcademy: clases cortas de IA y tech con rachas y XP</li>
          <li>🪐 IsaSpace: comparte tus creaciones con la comunidad</li>
          <li>🪙 Gana IsaBot Coins cada día y desbloquea temas y skins</li>
        </ul>

        <p className="welcome-sub">
          Prueba a escribirme: <b>«hazme un PDF con un plan de contenido para Instagram»</b> o{" "}
          <b>«dibújame un gatito astronauta»</b> 🚀
        </p>


        <div className="welcome-pro">
          <strong>👑 IsaBot Pro</strong>
          <span>
            Cerebros avanzados, Coach de Hábitos IA, Pomodoro, Outlines, Planeador mensual y regalo semanal.
          </span>
        </div>

        {code && (
          <div className="welcome-ref">
            <span>🎁 Invita amigas con tu código</span>
            <code>{code}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* noop */
                }
              }}
            >
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
        )}

        <button type="button" className="welcome-cta" onClick={close}>
          Empezar a crear ✨
        </button>
      </div>
    </div>
  );
}
