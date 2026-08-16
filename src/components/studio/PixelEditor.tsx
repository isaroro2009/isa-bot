import { useState } from "react";
import { PASTEL } from "./studio-model";

export type PixelDoc = { size: number; pixels: string[]; color: string };

type Props = { doc: PixelDoc; onChange: (doc: PixelDoc) => void };

export function PixelEditor({ doc, onChange }: Props) {
  const [tool, setTool] = useState<"pen" | "fill" | "erase">("pen");
  const [painting, setPainting] = useState(false);
  const cell = Math.floor(512 / doc.size);

  function paintAt(index: number) {
    const next = [...doc.pixels];
    if (tool === "erase") next[index] = "";
    else if (tool === "pen") next[index] = doc.color;
    else {
      const target = doc.pixels[index] ?? "";
      if (target === doc.color) return;
      const stack = [index];
      const seen = new Set<number>();
      while (stack.length) {
        const i = stack.pop()!;
        if (seen.has(i) || i < 0 || i >= next.length) continue;
        if ((doc.pixels[i] ?? "") !== target) continue;
        seen.add(i);
        next[i] = doc.color;
        const x = i % doc.size;
        if (x > 0) stack.push(i - 1);
        if (x < doc.size - 1) stack.push(i + 1);
        stack.push(i - doc.size, i + doc.size);
      }
    }
    onChange({ ...doc, pixels: next });
  }

  function resize(size: number) {
    onChange({ ...doc, size, pixels: Array(size * size).fill("") });
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        <button className={`studio-tool${tool === "pen" ? " on" : ""}`} onClick={() => setTool("pen")}>✏️ Lápiz</button>
        <button className={`studio-tool${tool === "fill" ? " on" : ""}`} onClick={() => setTool("fill")}>🪣 Balde</button>
        <button className={`studio-tool${tool === "erase" ? " on" : ""}`} onClick={() => setTool("erase")}>🧽 Borrar</button>
        <select className="studio-select" value={doc.size} onChange={(e) => resize(Number(e.target.value))}>
          <option value={16}>Rejilla 16×16</option>
          <option value={32}>Rejilla 32×32</option>
          <option value={64}>Rejilla 64×64</option>
        </select>
        <button className="studio-tool" onClick={() => onChange({ ...doc, pixels: Array(doc.size * doc.size).fill("") })}>
          🧹 Limpiar
        </button>
      </div>

      <div className="studio-stage-wrap">
        <div
          className="studio-stage pixel"
          style={{
            width: cell * doc.size,
            height: cell * doc.size,
            display: "grid",
            gridTemplateColumns: `repeat(${doc.size}, ${cell}px)`,
          }}
          onPointerDown={() => setPainting(true)}
          onPointerUp={() => setPainting(false)}
          onPointerLeave={() => setPainting(false)}
        >
          {doc.pixels.map((c, i) => (
            <div
              key={i}
              onPointerDown={() => paintAt(i)}
              onPointerEnter={() => painting && tool !== "fill" && paintAt(i)}
              style={{
                width: cell,
                height: cell,
                background: c || "transparent",
                boxShadow: "inset 0 0 0 0.5px rgba(122,63,191,0.12)",
                touchAction: "none",
              }}
            />
          ))}
        </div>
        <div className="studio-side">
          <p className="studio-side-title">Paleta</p>
          <div className="studio-swatches">
            {PASTEL.map((c) => (
              <button
                key={c}
                className={`studio-swatch${doc.color === c ? " on" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ ...doc, color: c })}
              />
            ))}
          </div>
          <label className="studio-field">
            Personalizado
            <input type="color" value={doc.color} onChange={(e) => onChange({ ...doc, color: e.target.value })} />
          </label>
          <p className="studio-hint">Al exportar, tu pixel art sale nítido (sin desenfoque) 👾</p>
        </div>
      </div>
    </div>
  );
}

/** Exporta el pixel art escalado y nítido. */
export function pixelToPng(doc: PixelDoc, scale = 16): string {
  const canvas = document.createElement("canvas");
  canvas.width = doc.size * scale;
  canvas.height = doc.size * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < doc.pixels.length; i++) {
    const c = doc.pixels[i];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect((i % doc.size) * scale, Math.floor(i / doc.size) * scale, scale, scale);
  }
  return canvas.toDataURL("image/png");
}
