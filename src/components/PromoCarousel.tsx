import { useEffect, useRef, useState } from "react";
import "./promo.css";

export type PromoAction =
  | { kind: "panel"; panel: string }
  | { kind: "href"; href: string }
  | { kind: "popup"; href: string };

type Slide = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  bg: string;
  action: PromoAction;
};

const SLIDES: Slide[] = [
  {
    id: "pro",
    emoji: "👑",
    title: "Hazte PRO por $4.99/mes",
    desc: "Texto ilimitado, +300 IBC cada mes, modelos avanzados y herramientas PRO sin recargo.",
    cta: "Ver plan PRO",
    bg: "linear-gradient(135deg, #b0489a, #6d3ea8)",
    action: { kind: "panel", panel: "store" },
  },
  {
    id: "ibc",
    emoji: "🪙",
    title: "¿Qué son las IsaBot Coins?",
    desc: "La moneda de IsaBot: gastas IBC al crear imágenes, guiones o usar el agente. Recarga desde $2.50.",
    cta: "Recargar coins",
    bg: "linear-gradient(135deg, #e2884c, #c74f7c)",
    action: { kind: "panel", panel: "store" },
  },
  {
    id: "isabella",
    emoji: "💜",
    title: "Conoce a Isabella",
    desc: "17 años, de Cali, Colombia. Creó IsaBot para que estudiar y emprender sea más fácil y bonito.",
    cta: "Su historia",
    bg: "linear-gradient(135deg, #7d5bd6, #d munch)".replace(" munch", "76fb0"),
    action: { kind: "panel", panel: "about" },
  },
  {
    id: "kdp",
    emoji: "📚",
    title: "Libros publicados en Amazon KDP",
    desc: "«Un Cuento de Navidad Futurista» y más títulos escritos por Isabella. Disponibles en Amazon.",
    cta: "Ver libros",
    bg: "linear-gradient(135deg, #2f7f6f, #4aa88a)",
    action: { kind: "href", href: "https://www.amazon.com/s?k=Isabella+Rodr%C3%ADguez+Roque" },
  },
  {
    id: "planners",
    emoji: "🗓️",
    title: "Planners digitales imprimibles",
    desc: "Agendas en PDF para organizar tu semana, tus metas y tu emprendimiento.",
    cta: "Ver planners",
    bg: "linear-gradient(135deg, #c9558d, #f0885f)",
    action: { kind: "href", href: "/market" },
  },
  {
    id: "academy",
    emoji: "🎓",
    title: "IsaAcademy",
    desc: "Aprende IA, diseño y emprendimiento con retos cortos y gana IBC mientras estudias.",
    cta: "Entrar a la Academy",
    bg: "linear-gradient(135deg, #4a63c9, #8f57c9)",
    action: { kind: "panel", panel: "academy" },
  },
];

export function PromoCarousel({ onAction }: { onAction: (a: PromoAction) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        const el = trackRef.current;
        if (el) el.scrollTo({ left: el.clientWidth * next, behavior: "smooth" });
        return next;
      });
    }, 6000);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="promo-wrap"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        className="promo-track"
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(i);
        }}
      >
        {SLIDES.map((s) => (
          <article key={s.id} className="promo-slide" style={{ background: s.bg }}>
            <div className="promo-text">
              <span className="promo-emoji">{s.emoji}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
            <button className="promo-cta" onClick={() => onAction(s.action)}>
              {s.cta}
            </button>
          </article>
        ))}
      </div>
      <div className="promo-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            className={i === index ? "active" : ""}
            aria-label={`Ir al anuncio ${i + 1}`}
            onClick={() => {
              setIndex(i);
              goTo(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
