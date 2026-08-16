import { useRef, useState } from "react";

export type DocDoc = { html: string };

type Props = {
  doc: DocDoc;
  onChange: (doc: DocDoc) => void;
  onAiText: (prompt: string) => Promise<string | null>;
};

export function DocEditor({ doc, onChange, onAiText }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  function cmd(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    if (ref.current) onChange({ html: ref.current.innerHTML });
  }

  async function writeWithAi() {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    const text = await onAiText(
      `Escribe en español el siguiente contenido para un documento, usando párrafos claros: ${aiPrompt}`,
    );
    setAiBusy(false);
    if (text && ref.current) {
      const html = text
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      ref.current.innerHTML += html;
      onChange({ html: ref.current.innerHTML });
      setAiOpen(false);
      setAiPrompt("");
    }
  }

  return (
    <div className="studio-editor">
      <div className="studio-toolbar">
        <button className="studio-tool" onClick={() => cmd("formatBlock", "<h1>")}>H1</button>
        <button className="studio-tool" onClick={() => cmd("formatBlock", "<h2>")}>H2</button>
        <button className="studio-tool" onClick={() => cmd("formatBlock", "<p>")}>¶</button>
        <button className="studio-tool" onClick={() => cmd("bold")}><strong>B</strong></button>
        <button className="studio-tool" onClick={() => cmd("italic")}><em>I</em></button>
        <button className="studio-tool" onClick={() => cmd("underline")}>U̲</button>
        <button className="studio-tool" onClick={() => cmd("insertUnorderedList")}>• Lista</button>
        <button className="studio-tool" onClick={() => cmd("insertOrderedList")}>1. Lista</button>
        <button className="studio-tool" onClick={() => cmd("justifyCenter")}>↔️ Centrar</button>
        <button className="studio-tool ai" onClick={() => setAiOpen(true)}>✨ Escribir con IsaBot</button>
      </div>

      <div className="studio-doc-page">
        <div
          ref={ref}
          className="studio-doc-body"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange({ html: (e.target as HTMLDivElement).innerHTML })}
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </div>

      {aiOpen && (
        <div className="modal-overlay" onClick={() => setAiOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>✨ Escribir con IsaBot</h3>
            <p className="habits-sub">Dime de qué se trata y lo añado al final del documento.</p>
            <textarea
              className="studio-input"
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Introducción para mi proyecto de emprendimiento sobre moda sostenible"
            />
            <button className="studio-tool ai" disabled={aiBusy} onClick={writeWithAi}>
              {aiBusy ? "Escribiendo…" : "Añadir al documento"}
            </button>
            <button className="close-settings" onClick={() => setAiOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
