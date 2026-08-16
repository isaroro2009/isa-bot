import { useEffect, useRef, useState } from "react";

export function PointsChip({
  points,
  onClick,
}: {
  points: number | null;
  onClick: () => void;
}) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (points === null) return;
    if (prev.current !== null && points !== prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      return () => clearTimeout(t);
    }
    prev.current = points;
  }, [points]);

  return (
    <button
      className={`pts-chip ${pulse ? "pulse" : ""}`}
      onClick={onClick}
      aria-label="Mis IsaPuntos"
      title="Mis IsaPuntos — canjear recompensas"
    >
      <span className="pts-chip-star">🌟</span>
      <span className="pts-chip-num">{points ?? "—"}</span>
      <span className="pts-chip-label">IsaPuntos</span>
    </button>
  );
}
