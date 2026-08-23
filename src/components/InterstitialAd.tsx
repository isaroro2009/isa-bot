import { useState } from "react";
import "./promo.css";
import type { PromoAction } from "./PromoCarousel";

type Ad = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  bg: string;
  action: PromoAction;
};

export const INTERSTITIAL_ADS: Ad[] = [
  {
    id: "pro",
    emoji: "👑",
    title: "Pásate a Plan PRO por $4.99/mes",
    desc: "Texto ilimitado, +300 IBC cada mes, modelos avanzados y todas las herramientas PRO sin recargo.",
    cta: "Ver Plan PRO",
    bg: "linear-gradient(135deg, #b0489a, #6d3ea8)",
    action: { kind: "panel", panel: "subscribe" },
  },
  {
    id: "ibc",
    emoji: "🪙",
    title: "¿Qué son las IsaBot Coins (IBC)?",
    desc: "Son la energía de IsaBot: gastas IBC al crear imágenes, guiones, PDFs o usar el agente. Recarga desde $2.50 y sigue creando.",
    cta: "Recargar coins",
    bg: "linear-gradient(135deg, #e2884c, #c74f7c)",
    action: { kind: "store" },
  },
  {
    id: "isabella",
    emoji: "💜",
    title: "Conoce a Isabella y sus libros KDP",
    desc: "17 años, de Cali (Colombia), creadora de IsaBot. También escribe libros publicados en Amazon KDP.",
    cta: "Ver sus libros",
    bg: "linear-gradient(135deg, #7d5bd6, #d76fb0)",
    action: { kind: "href", href: "https://www.amazon.com/s?k=Isabella+Rodriguez+Roque" },
  },
  {
    id: "academy",
    emoji: "🎓",
    title: "Agendas digitales & IsaAcademy",
    desc: "Planners imprimibles para organizar tu semana y clases cortas de IA, diseño y emprendimiento.",
    cta: "Entrar a la Academy",
    bg: "linear-gradient(135deg, #4a63c9, #8f57c9)",
    action: { kind: "panel", panel: "academy" },
  },
];

/** 🎬 Anuncio a pantalla completa estilo Duolingo, entre acciones del usuario. */
export function InterstitialAd({
  index,
  onClose,
  onAction,
}: {
  index: number;
  onClose: () => void;
  onAction: (a: PromoAction) => void;
}) {
  const [ad] = useState(() => INTERSTITIAL_ADS[index % INTERSTITIAL_ADS.length]);
  return (
    <div className="ad-back" onClick={onClose} role="dialog" aria-label={ad.title}>
      <div className="ad-card" style={{ background: ad.bg }} onClick={(e) => e.stopPropagation()}>
        <span className="ad-emoji">{ad.emoji}</span>
        <h3>{ad.title}</h3>
        <p>{ad.desc}</p>
        <button
          className="ad-cta"
          onClick={() => {
            onAction(ad.action);
            onClose();
          }}
        >
          {ad.cta}
        </button>
        <button className="ad-skip" onClick={onClose}>
          Seguir en IsaBot
        </button>
      </div>
    </div>
  );
}
