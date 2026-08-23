import { useEffect, useId, useRef, useState } from "react";
import "./coin3d.css";

export type CoinSkinId = "rosita" | "gold" | "diamond";

export type CoinSkin = {
  id: CoinSkinId;
  name: string;
  tagline: string;
  /** cómo se desbloquea */
  requirement: string;
};

export const COIN_SKINS: CoinSkin[] = [
  { id: "rosita", name: "Rosita Classic", tagline: "Neón rosa + oro", requirement: "Gratis" },
  { id: "gold", name: "Gold Luxe", tagline: "Oro pulido, luz blanca", requirement: "Racha de 7 días o PRO" },
  { id: "diamond", name: "Diamond Cyber", tagline: "Cian iridiscente, neón morado", requirement: "Compra en la tienda" },
];

const SKIN_KEY = "isabot.coin.skin";

export function loadSkin(): CoinSkinId {
  if (typeof window === "undefined") return "rosita";
  const v = window.localStorage.getItem(SKIN_KEY);
  return v === "gold" || v === "diamond" ? v : "rosita";
}

export function saveSkin(id: CoinSkinId) {
  if (typeof window !== "undefined") window.localStorage.setItem(SKIN_KEY, id);
}

export function isSkinUnlocked(id: CoinSkinId, opts: { isPro: boolean; streakDays: number; owned: boolean }) {
  if (id === "rosita") return true;
  if (id === "gold") return opts.isPro || opts.streakDays >= 7;
  return opts.owned;
}

type Props = {
  skin?: CoinSkinId;
  size?: number;
  /** anima al cambiar */
  state?: "idle" | "collect" | "deduct" | "deny";
  spinning?: boolean;
  isPro?: boolean;
  label?: string;
  onClick?: () => void;
  title?: string;
};

/**
 * Moneda IBC "física": SVG multicapa con inclinación 3D real (transform-style: preserve-3d),
 * brillo neón, chispas y anillos de circuito. Sin dependencias 3D pesadas.
 */
export function IsaCoin3D({
  skin = "rosita",
  size = 220,
  state = "idle",
  spinning = false,
  isPro = false,
  label,
  onClick,
  title,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const uid = useId().replace(/:/g, "");

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 26, y: px * 30 });
  }

  const cls = [
    "coin3d",
    `skin-${skin}`,
    spinning ? "spin" : "",
    state !== "idle" ? `st-${state}` : "",
    isPro ? "is-pro" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={{ width: size, height: size }}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={title}
      aria-label={label}
    >
      <div className="coin3d-glow" />
      <div
        className="coin3d-body"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className="coin3d-edge" />
        <svg viewBox="0 0 400 400" className="coin3d-face">
          <defs>
            <radialGradient id={`${uid}-core`} cx="50%" cy="42%">
              <stop offset="0%" className="g-core-0" />
              <stop offset="65%" className="g-core-1" />
              <stop offset="100%" className="g-core-2" />
            </radialGradient>
            <linearGradient id={`${uid}-rim`} x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" className="g-rim-0" />
              <stop offset="45%" className="g-rim-1" />
              <stop offset="100%" className="g-rim-2" />
            </linearGradient>
            <filter id={`${uid}-blur`}>
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <path id={`${uid}-top`} d="M48,200 A152,152 0 0 1 352,200" fill="none" />
            <path id={`${uid}-bot`} d="M22,200 A178,178 0 0 0 378,200" fill="none" />
          </defs>

          {/* rim de metal */}
          <circle cx="200" cy="200" r="196" fill={`url(#${uid}-rim)`} />
          <circle cx="200" cy="200" r="196" className="rim-stroke" fill="none" strokeWidth="3" />
          <circle cx="200" cy="200" r="168" className="rim-inner" fill="none" strokeWidth="2" />

          {/* núcleo neón */}
          <circle cx="200" cy="200" r="152" fill={`url(#${uid}-core)`} />
          <circle cx="200" cy="200" r="152" className="core-ring" fill="none" strokeWidth="6" />

          {/* circuitería */}
          <g className="circuit" fill="none" strokeWidth="4" strokeLinecap="round">
            <circle cx="200" cy="200" r="132" strokeDasharray="18 12" />
            <circle cx="200" cy="200" r="118" strokeDasharray="6 14" />
            <path d="M200,68 v26 M200,306 v26 M68,200 h26 M306,200 h26" />
            <path d="M120,120 l24,24 M280,120 l-24,24 M120,280 l24,-24 M280,280 l-24,-24" />
          </g>

          {/* disco interior */}
          <circle cx="200" cy="200" r="96" className="inner-disc" />

          {/* emblema flor de cerezo */}
          <g className="emblem" transform="translate(200 190)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} rx="21" ry="34" cy="-30" transform={`rotate(${a})`} />
            ))}
            <circle r="10" className="emblem-core" />
          </g>

          {/* chispas */}
          <g className="sparks">
            <path d="M132,148 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4z" />
            <path d="M272,166 l3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 8,-3z" />
            <path d="M150,252 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3z" />
          </g>

          <text className="ibc-mark" x="200" y="272" textAnchor="middle">IBC</text>

          {/* texto del rim */}
          <text className="rim-text top">
            <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">I S A</textPath>
          </text>
          <text className="rim-text bottom">
            <textPath href={`#${uid}-bot`} startOffset="50%" textAnchor="middle">C O I N</textPath>
          </text>
        </svg>

        {isPro && <div className="coin3d-pro">👑 PRO</div>}
      </div>
      {label && <div className="coin3d-label">{label}</div>}
    </div>
  );
}

/** Versión mini para el header, con animación de "collect"/"deduct". */
export function CoinMini({
  skin,
  balance,
  isPro,
  onClick,
  title,
}: {
  skin: CoinSkinId;
  balance: number;
  isPro: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "collect" | "deduct">("idle");
  const prev = useRef(balance);

  useEffect(() => {
    if (balance === prev.current) return;
    const up = balance > prev.current;
    prev.current = balance;
    setState(up ? "collect" : "deduct");
    const t = setTimeout(() => setState("idle"), 900);
    return () => clearTimeout(t);
  }, [balance]);

  return (
    <button className={`coin-mini-btn st-${state}`} onClick={onClick} title={title} aria-label={`${balance} IsaBot Coins`}>
      <IsaCoin3D skin={skin} size={34} isPro={isPro} state={state} />
      <span className="coin-mini-num">{balance}</span>
    </button>
  );
}
