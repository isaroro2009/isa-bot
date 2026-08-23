import { useEffect, useLayoutEffect, useState } from "react";
import "@/components/ibc/ibc.css";

type Step = {
  selector?: string;
  emoji: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    selector: '[data-tour="coins"]',
    emoji: "🪙",
    title: "Tus IsaBot Coins",
    body: "Este es tu saldo. Cada mensaje, imagen o tarea del agente cuesta coins. Toca la moneda para abrir tu bóveda y ver tu historial.",
  },
  {
    selector: '[data-tour="streak"]',
    emoji: "🔥",
    title: "Tu racha diaria",
    body: "Vuelve cada día para mantener la llama viva: día 3 te regalo +5 coins y día 7 son +15 coins de bonus.",
  },
  {
    selector: ".motor-badge",
    emoji: "🧠",
    title: "Cambia mi cerebro de IA",
    body: "Aquí ves el modelo activo. En el menú lateral, en «Cerebro de IA», puedes cambiar entre modelos rápidos y modelos más potentes.",
  },
  {
    emoji: "🤖",
    title: "Agente autónomo (PDF y correos)",
    body: "En Herramientas está el agente: le pides un documento o un correo y él lo redacta y te lo entrega en PDF. Cuesta unos coins, pero te ahorra horas ✨",
  },
];

const KEY = "isabot_tour_done_v1";

export function OnboardingTour({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) return;
    if (window.localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [active]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const sel = STEPS[i]?.selector;
      const el = sel ? document.querySelector(sel) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, i]);

  if (!open) return null;

  const step = STEPS[i];
  const finish = () => {
    window.localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const cardStyle: React.CSSProperties = rect
    ? {
        top: Math.min(window.innerHeight - 200, rect.bottom + 14),
        left: Math.max(16, Math.min(window.innerWidth - 336, rect.left + rect.width / 2 - 160)),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      <div className="tour-mask" onClick={finish} />
      {rect && (
        <div
          className="tour-ring"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div className="tour-card" style={cardStyle}>
        <h4>
          <span className="tour-hand">👉</span>
          {step.emoji} {step.title}
        </h4>
        <p>{step.body}</p>
        <div className="tour-row">
          <div className="tour-dots">
            {STEPS.map((_, n) => (
              <span key={n} className={`tour-dot${n === i ? " on" : ""}`} />
            ))}
          </div>
          <div className="tour-row" style={{ gap: 8 }}>
            <button className="tour-skip" onClick={finish}>
              Saltar
            </button>
            <button className="tour-btn" onClick={() => (i === STEPS.length - 1 ? finish() : setI(i + 1))}>
              {i === STEPS.length - 1 ? "¡Listo! 💜" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
