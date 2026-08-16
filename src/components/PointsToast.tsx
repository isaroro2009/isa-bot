import { useEffect, useState } from "react";

type ToastItem = { id: number; delta: number; label?: string };

let listeners: Array<(t: ToastItem) => void> = [];
let seq = 1;

export function emitPointsToast(delta: number, label?: string) {
  if (!delta) return;
  const t: ToastItem = { id: seq++, delta, label };
  listeners.forEach((fn) => fn(t));
}

export function PointsToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const fn = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  return (
    <div className="pts-toast-host">
      {items.map((t) => (
        <div key={t.id} className="pts-toast">
          <span className="pts-toast-star">🌟</span>
          <span className="pts-toast-txt">
            {t.label ?? `¡Felicidades! Has ganado +${t.delta} IsaPuntos`}
          </span>
          <span className="pts-toast-plus">+{t.delta}</span>
        </div>
      ))}
    </div>
  );
}
