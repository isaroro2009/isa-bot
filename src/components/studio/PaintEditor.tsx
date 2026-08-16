import { useEffect, useRef, useState } from "react";
import { PASTEL } from "./studio-model";

export type PaintDoc = { w: number; h: number; layers: Array<string | null>; active: number };

type Props = { doc: PaintDoc; onChange: (doc: PaintDoc) => void };

const BRUSHES = [
  { key: "soft", label: "☁️ Suave", blur: 6 },
  { key: "hard", label: "✏️ Duro", blur: 0 },
  { key: "marker", label: "🖍️ Marcador", blur: 2 },
] as const;

export function PaintEditor({ doc, onChange }: Props) {
  const canvases = useRef<Array<HTMLCanvasElement | null>>([null, null, null]);
  const [color, setColor] = useState("#ff85a2");
  const [size, setSize] = useState(18);
  const [opacity, setOpacity] = useState(1);
  const [brush, setBrush] = useState<(typeof BRUSHES)[number]["key"]>("soft");
  const [eraser, setEraser] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Cargar capas guardadas una sola vez por proyecto.
  useEffect(() => {
    doc.layers.forEach((src, i) => {
      const c = canvases.current[i];
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      if (src) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = src;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit() {
    const layers = canvases.current.map((c) => (c ? c.toDataURL("image/png") : null));
    onChange({ ...doc, layers });
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pos(e);
    stroke(e);
  }

  function stroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvases.current[doc.active];
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const p = pos(e);
    const from = last.current ?? p;
    ctx.save();
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.globalAlpha = eraser ? 1 : opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const blur = BRUSHES.find((b) => b.key === brush)?.blur ?? 0;
    if (blur && !eraser) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    last.current = p;
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    commit();
  }

  function clearLayer() {
    const c = canvases.current[doc.active];
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    commit();
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        {BRUSHES.map((b) => (
          <button
            key={b.key}
            className={`studio-tool${brush === b.key && !eraser ? " on" : ""}`}
            onClick={() => {
              setBrush(b.key);
              setEraser(false);
            }}
          >
            {b.label}
          </button>
        ))}
        <button className={`studio-tool${eraser ? " on" : ""}`} onClick={() => setEraser(!eraser)}>🧽 Borrador</button>
        <label className="studio-inline">
          Grosor
          <input type="range" min={2} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <label className="studio-inline">
          Opacidad
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          />
        </label>
        <select
          className="studio-select"
          value={doc.active}
          onChange={(e) => onChange({ ...doc, active: Number(e.target.value) })}
        >
          <option value={0}>Capa 1</option>
          <option value={1}>Capa 2</option>
          <option value={2}>Capa 3</option>
        </select>
        <button className="studio-tool" onClick={clearLayer}>🧹 Limpiar capa</button>
      </div>

      <div className="studio-stage-wrap">
        <div className="studio-stage paint" style={{ width: 560, height: (560 * doc.h) / doc.w }}>
          {[0, 1, 2].map((i) => (
            <canvas
              key={i}
              ref={(el) => {
                canvases.current[i] = el;
              }}
              width={doc.w}
              height={doc.h}
              onPointerDown={i === doc.active ? down : undefined}
              onPointerMove={i === doc.active ? stroke : undefined}
              onPointerUp={i === doc.active ? up : undefined}
              onPointerLeave={i === doc.active ? up : undefined}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                touchAction: "none",
                pointerEvents: i === doc.active ? "auto" : "none",
                zIndex: i + 1,
                cursor: "crosshair",
              }}
            />
          ))}
        </div>
        <div className="studio-side">
          <p className="studio-side-title">Color</p>
          <div className="studio-swatches">
            {PASTEL.map((c) => (
              <button key={c} className="studio-swatch" style={{ background: c }} onClick={() => { setColor(c); setEraser(false); }} />
            ))}
          </div>
          <label className="studio-field">
            Personalizado
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <p className="studio-hint">Pinta con el dedo o el mouse. Cada capa se guarda sola en la nube 💾</p>
        </div>
      </div>
    </div>
  );
}

/** Une las 3 capas en un PNG exportable. */
export function flattenPaint(doc: PaintDoc): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = doc.w;
    canvas.height = doc.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve("");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, doc.w, doc.h);
    const srcs = doc.layers.filter((s): s is string => Boolean(s));
    let pending = srcs.length;
    if (pending === 0) return resolve(canvas.toDataURL("image/png"));
    srcs.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        if (--pending === 0) resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        if (--pending === 0) resolve(canvas.toDataURL("image/png"));
      };
      img.src = src;
    });
  });
}
