import { useState } from "react";

export type Slide = { title: string; body: string; bg: string; accent: string; image?: string };
export type SlidesDoc = { slides: Slide[] };

const THEMES = [
  { label: "🌸 Pastel", bg: "#f6eefb", accent: "#7a3fbf" },
  { label: "🍑 Durazno", bg: "#fff3e8", accent: "#d9556e" },
  { label: "💙 Cielo", bg: "#eaf6ff", accent: "#2b5fa8" },
  { label: "🌿 Menta", bg: "#eafaf1", accent: "#1c6b53" },
  { label: "🌙 Noche", bg: "#2a1f3d", accent: "#ffd6ec" },
];

type Props = {
  doc: SlidesDoc;
  onChange: (doc: SlidesDoc) => void;
  onAiText: (prompt: string) => Promise<string | null>;
};

export function SlidesEditor({ doc, onChange, onAiText }: Props) {
  const [current, setCurrent] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const slide = doc.slides[current] ?? doc.slides[0];

  function patch(p: Partial<Slide>) {
    onChange({ slides: doc.slides.map((s, i) => (i === current ? { ...s, ...p } : s)) });
  }

  function addSlide() {
    const base = slide ?? { bg: "#f6eefb", accent: "#7a3fbf" };
    onChange({
      slides: [...doc.slides, { title: "Nueva diapositiva", body: "Tu contenido", bg: base.bg, accent: base.accent }],
    });
    setCurrent(doc.slides.length);
  }

  async function outlineWithAi() {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    const text = await onAiText(
      `Crea una presentación de 5 diapositivas sobre: ${aiPrompt}. Devuelve exactamente una diapositiva por línea con el formato "Título | contenido corto". Sin numeración, sin texto extra.`,
    );
    setAiBusy(false);
    if (!text) return;
    const parsed = text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.]+\s*/, "").trim())
      .filter((l) => l.includes("|"))
      .map((l) => {
        const [t, ...rest] = l.split("|");
        return {
          title: t.trim(),
          body: rest.join("|").trim(),
          bg: slide?.bg ?? "#f6eefb",
          accent: slide?.accent ?? "#7a3fbf",
        } as Slide;
      });
    if (parsed.length) {
      onChange({ slides: parsed });
      setCurrent(0);
      setAiOpen(false);
      setAiPrompt("");
    }
  }

  if (presenting) {
    return (
      <div className="studio-present" onClick={() => setCurrent((c) => Math.min(c + 1, doc.slides.length - 1))}>
        <div className="studio-present-slide" style={{ background: slide?.bg }}>
          <h1 style={{ color: slide?.accent }}>{slide?.title}</h1>
          <p>{slide?.body}</p>
        </div>
        <div className="studio-present-bar">
          <button className="studio-mini" onClick={(e) => { e.stopPropagation(); setCurrent((c) => Math.max(0, c - 1)); }}>◀</button>
          <span>{current + 1} / {doc.slides.length}</span>
          <button className="studio-mini" onClick={(e) => { e.stopPropagation(); setCurrent((c) => Math.min(doc.slides.length - 1, c + 1)); }}>▶</button>
          <button className="studio-mini danger" onClick={(e) => { e.stopPropagation(); setPresenting(false); }}>✕ Salir</button>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        <button className="studio-tool" onClick={addSlide}>➕ Diapositiva</button>
        <button className="studio-tool" onClick={() => setPresenting(true)}>▶️ Presentar</button>
        <select
          className="studio-select"
          value=""
          onChange={(e) => {
            const t = THEMES[Number(e.target.value)];
            if (t) onChange({ slides: doc.slides.map((s) => ({ ...s, bg: t.bg, accent: t.accent })) });
          }}
        >
          <option value="">🎨 Tema…</option>
          {THEMES.map((t, i) => (
            <option key={t.label} value={i}>{t.label}</option>
          ))}
        </select>
        <button className="studio-tool ai" onClick={() => setAiOpen(true)}>✨ Armar con IsaBot</button>
        {doc.slides.length > 1 && (
          <button
            className="studio-tool danger"
            onClick={() => {
              onChange({ slides: doc.slides.filter((_, i) => i !== current) });
              setCurrent(0);
            }}
          >
            🗑️ Borrar esta
          </button>
        )}
      </div>

      <div className="studio-slides-wrap">
        <div className="studio-slides-strip">
          {doc.slides.map((s, i) => (
            <button
              key={i}
              className={`studio-thumb${i === current ? " on" : ""}`}
              style={{ background: s.bg }}
              onClick={() => setCurrent(i)}
            >
              <span style={{ color: s.accent }}>{i + 1}. {s.title || "Sin título"}</span>
            </button>
          ))}
        </div>

        <div className="studio-slide-canvas" style={{ background: slide?.bg }}>
          <input
            className="studio-slide-title"
            style={{ color: slide?.accent }}
            value={slide?.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Título"
          />
          <textarea
            className="studio-slide-body"
            value={slide?.body ?? ""}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Contenido de la diapositiva"
          />
        </div>
      </div>

      {aiOpen && (
        <div className="modal-overlay" onClick={() => setAiOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>✨ Armar presentación con IsaBot</h3>
            <p className="habits-sub">Reemplazo las diapositivas por una propuesta de 5.</p>
            <textarea
              className="studio-input"
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Pitch de mi marca de accesorios hechos a mano"
            />
            <button className="studio-tool ai" disabled={aiBusy} onClick={outlineWithAi}>
              {aiBusy ? "Pensando…" : "Crear diapositivas"}
            </button>
            <button className="close-settings" onClick={() => setAiOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function slidesToPrintHtml(doc: SlidesDoc): string {
  return doc.slides
    .map(
      (s) => `<section style="page-break-after:always;background:${s.bg};padding:64px;border-radius:24px;margin-bottom:24px;min-height:520px;">
        <h1 style="color:${s.accent};font-size:44px;">${escapeHtml(s.title)}</h1>
        <p style="font-size:24px;white-space:pre-wrap;">${escapeHtml(s.body)}</p>
      </section>`,
    )
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}
