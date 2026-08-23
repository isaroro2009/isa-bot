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
        <h2>¡Bienvenida{name ? `, ${name}` : ""} a IsaBot!</h2>
        <p className="welcome-sub">
          Soy tu copiloto de IA creativa, hecha por Isabella Rodríguez Roque. Esto puedes hacer desde hoy:
        </p>

        <ul className="welcome-list">
          <li>💬 Chatear con IA multimodal y generar imágenes</li>
          <li>🎨 Paleta de colores, notas rápidas y gestor de tareas</li>
          <li>🎓 IsaAcademy: clases de IA y tech con rachas y XP</li>
          <li>🪐 IsaSpace: comparte tus creaciones con la comunidad</li>
          <li>🧺 IsaMarket: ofrece tus servicios freelance o encuentra talento</li>
          <li>🏆 Gana IsaBot Coins cada día y canjéalos por recompensas</li>
        </ul>


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
