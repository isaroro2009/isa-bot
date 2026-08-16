import { useRef, useState } from "react";
import { DESIGN_TEMPLATES, PASTEL, uid, type DesignDoc, type DesignItem } from "./studio-model";
import { fileToDataUrl } from "./studio-export";

type Props = {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  onAiImage: (prompt: string) => Promise<string | null>;
};

export function DesignEditor({ doc, onChange, onAiImage }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = doc.items.find((i) => i.id === sel) ?? null;
  const scale = Math.min(1, 520 / doc.w);

  function update(items: DesignItem[]) {
    onChange({ ...doc, items });
  }
  function patch(id: string, p: Partial<DesignItem>) {
    update(doc.items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }
  function add(type: DesignItem["type"], extra: Partial<DesignItem> = {}) {
    const item: DesignItem = {
      id: uid(),
      type,
      x: Math.round(doc.w * 0.2),
      y: Math.round(doc.h * 0.3),
      w: type === "text" ? Math.round(doc.w * 0.6) : Math.round(doc.w * 0.35),
      h: type === "text" ? 120 : Math.round(doc.w * 0.35),
      fill: type === "ellipse" ? "#e0d5ff" : "#ffd6ec",
      radius: 24,
      text: type === "text" ? "Escribe aquí" : undefined,
      size: 72,
      weight: 800,
      color: "#6b3fa0",
      align: "left",
      ...extra,
    };
    update([...doc.items, item]);
    setSel(item.id);
  }

  function startDrag(e: React.PointerEvent, item: DesignItem, mode: "move" | "resize") {
    e.stopPropagation();
    setSel(item.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const base = { ...item };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (mode === "move") patch(item.id, { x: Math.round(base.x + dx), y: Math.round(base.y + dy) });
      else
        patch(item.id, {
          w: Math.max(24, Math.round(base.w + dx)),
          h: Math.max(24, Math.round(base.h + dy)),
        });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function pickImage(file: File) {
    const src = await fileToDataUrl(file);
    add("image", { src, w: Math.round(doc.w * 0.5), h: Math.round(doc.w * 0.5) });
  }

  async function generate() {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    const img = await onAiImage(aiPrompt);
    setAiBusy(false);
    if (img) {
      add("image", { src: img, x: 0, y: 0, w: doc.w, h: doc.h });
      setAiOpen(false);
      setAiPrompt("");
    }
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        <button className="studio-tool" onClick={() => add("rect")}>⬛ Forma</button>
        <button className="studio-tool" onClick={() => add("ellipse")}>⚪ Círculo</button>
        <button className="studio-tool" onClick={() => add("text")}>🅣 Texto</button>
        <button className="studio-tool" onClick={() => fileRef.current?.click()}>🖼️ Imagen</button>
        <button className="studio-tool ai" onClick={() => setAiOpen(true)}>✨ Imagen con IA</button>
        <select
          className="studio-select"
          value=""
          onChange={(e) => {
            const t = DESIGN_TEMPLATES.find((x) => x.key === e.target.value);
            if (t) {
              onChange(JSON.parse(JSON.stringify(t.doc)) as DesignDoc);
              setSel(null);
            }
          }}
        >
          <option value="">📐 Plantillas…</option>
          {DESIGN_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <label className="studio-inline">
          Fondo
          <input type="color" value={doc.bg} onChange={(e) => onChange({ ...doc, bg: e.target.value })} />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickImage(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="studio-stage-wrap">
        <div
          ref={stageRef}
          className="studio-stage"
          onPointerDown={() => setSel(null)}
          style={{
            width: doc.w * scale,
            height: doc.h * scale,
            background: doc.bg,
          }}
        >
          {doc.items.map((it) => (
            <div
              key={it.id}
              onPointerDown={(e) => startDrag(e, it, "move")}
              style={{
                position: "absolute",
                left: it.x * scale,
                top: it.y * scale,
                width: it.w * scale,
                height: it.h * scale,
                borderRadius: it.type === "ellipse" ? "50%" : (it.radius ?? 0) * scale,
                background: it.type === "text" || it.type === "image" ? "transparent" : it.fill,
                outline: sel === it.id ? "2px dashed #ff85a2" : "none",
                cursor: "move",
                overflow: "hidden",
                display: "flex",
                alignItems: "flex-start",
                touchAction: "none",
              }}
            >
              {it.type === "image" && it.src && (
                <img src={it.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {it.type === "text" && (
                <span
                  style={{
                    width: "100%",
                    fontSize: (it.size ?? 48) * scale,
                    fontWeight: it.weight ?? 700,
                    color: it.color,
                    textAlign: it.align ?? "left",
                    lineHeight: 1.2,
                    userSelect: "none",
                  }}
                >
                  {it.text}
                </span>
              )}
              {sel === it.id && (
                <span
                  onPointerDown={(e) => startDrag(e, it, "resize")}
                  style={{
                    position: "absolute",
                    right: -6,
                    bottom: -6,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#ff85a2",
                    cursor: "nwse-resize",
                    touchAction: "none",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="studio-side">
          {!selected && <p className="studio-hint">Toca un elemento para editarlo 🌸</p>}
          {selected && (
            <>
              <p className="studio-side-title">
                {selected.type === "text" ? "Texto" : selected.type === "image" ? "Imagen" : "Forma"}
              </p>
              {selected.type === "text" && (
                <>
                  <textarea
                    className="studio-input"
                    rows={3}
                    value={selected.text ?? ""}
                    onChange={(e) => patch(selected.id, { text: e.target.value })}
                  />
                  <label className="studio-field">
                    Tamaño
                    <input
                      type="range"
                      min={16}
                      max={220}
                      value={selected.size ?? 48}
                      onChange={(e) => patch(selected.id, { size: Number(e.target.value) })}
                    />
                  </label>
                  <div className="studio-swatches">
                    {PASTEL.map((c) => (
                      <button
                        key={c}
                        className="studio-swatch"
                        style={{ background: c }}
                        onClick={() => patch(selected.id, { color: c })}
                      />
                    ))}
                  </div>
                  <div className="studio-row">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} className="studio-mini" onClick={() => patch(selected.id, { align: a })}>
                        {a === "left" ? "⬅️" : a === "center" ? "↔️" : "➡️"}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(selected.type === "rect" || selected.type === "ellipse") && (
                <>
                  <div className="studio-swatches">
                    {PASTEL.map((c) => (
                      <button
                        key={c}
                        className="studio-swatch"
                        style={{ background: c }}
                        onClick={() => patch(selected.id, { fill: c })}
                      />
                    ))}
                  </div>
                  {selected.type === "rect" && (
                    <label className="studio-field">
                      Redondez
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={selected.radius ?? 0}
                        onChange={(e) => patch(selected.id, { radius: Number(e.target.value) })}
                      />
                    </label>
                  )}
                </>
              )}
              <div className="studio-row">
                <button
                  className="studio-mini"
                  onClick={() => {
                    const rest = doc.items.filter((i) => i.id !== selected.id);
                    update([...rest, selected]);
                  }}
                >
                  ⬆️ Al frente
                </button>
                <button
                  className="studio-mini"
                  onClick={() => {
                    const rest = doc.items.filter((i) => i.id !== selected.id);
                    update([selected, ...rest]);
                  }}
                >
                  ⬇️ Al fondo
                </button>
              </div>
              <button
                className="studio-mini danger"
                onClick={() => {
                  update(doc.items.filter((i) => i.id !== selected.id));
                  setSel(null);
                }}
              >
                🗑️ Borrar
              </button>
            </>
          )}
        </div>
      </div>

      {aiOpen && (
        <div className="modal-overlay" onClick={() => setAiOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>✨ Imagen con IsaBot</h3>
            <p className="habits-sub">Describe la imagen o el fondo que quieres en tu lienzo.</p>
            <textarea
              className="studio-input"
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Fondo pastel con flores y degradado rosa-morado"
            />
            <button className="studio-tool ai" disabled={aiBusy} onClick={generate}>
              {aiBusy ? "Creando…" : "Generar y poner en el lienzo"}
            </button>
            <button className="close-settings" onClick={() => setAiOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
