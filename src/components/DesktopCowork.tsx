import { useState } from "react";
import { getDesktop, isDesktopApp } from "@/lib/desktop-bridge";

// Modo Co-work: IsaBot ve tu pantalla y ejecuta acciones (click/type/keyTap).
// Loop: screenshot → modelo multimodal → parsear acciones JSON → ejecutar → repetir.
// Máximo 8 iteraciones, con confirmación al usuario antes de arrancar.

type Action =
  | { type: "click"; x: number; y: number }
  | { type: "double_click"; x: number; y: number }
  | { type: "type"; text: string }
  | { type: "key"; key: string }
  | { type: "done"; summary: string };

type StepLog = { screenshot?: string; think: string; actions: Action[] };

export function DesktopCowork({ onClose }: { onClose: () => void }) {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<StepLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isDesktopApp()) {
    return (
      <div className="agent-overlay" onClick={onClose}>
        <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
          <button className="agent-close" onClick={onClose}>✕</button>
          <h2>🖥️ Modo Co-work</h2>
          <p>Este modo sólo funciona en la <b>app de escritorio de IsaBot</b>. Descárgala desde el menú.</p>
        </div>
      </div>
    );
  }

  async function runOnce() {
    const desktop = getDesktop();
    if (!desktop || !task.trim() || running) return;
    setRunning(true);
    setError(null);
    setLog([]);
    try {
      const { width, height } = await desktop.getScreenSize();
      const history: StepLog[] = [];
      for (let step = 0; step < 8; step++) {
        const shot = await desktop.screenshot();
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mensaje:
              `Modo Co-work del PC. Tarea del usuario: "${task}". Pantalla: ${width}x${height}. ` +
              `Analiza la captura y responde SOLO con un JSON con esta forma exacta, sin markdown:\n` +
              `{"think":"...","actions":[{"type":"click","x":123,"y":456},{"type":"type","text":"..."},{"type":"key","key":"enter"},{"type":"done","summary":"..."}]}\n` +
              `Usa "done" cuando la tarea esté completa. Máximo 3 acciones por paso. Coordenadas absolutas en píxeles.`,
            imagen: shot,
            historial: [],
            personalidad: "profesional",
          }),
        });
        const data = await r.json();
        const raw = (data.response || data.respuesta || "").toString();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("El modelo no devolvió JSON válido");
        const parsed = JSON.parse(jsonMatch[0]) as { think: string; actions: Action[] };
        const entry: StepLog = { screenshot: shot, think: parsed.think, actions: parsed.actions };
        history.push(entry);
        setLog([...history]);

        let done = false;
        for (const a of parsed.actions) {
          if (a.type === "click") { await desktop.moveMouse(a.x, a.y); await desktop.click(); }
          else if (a.type === "double_click") { await desktop.moveMouse(a.x, a.y); await desktop.doubleClick(); }
          else if (a.type === "type") { await desktop.type(a.text); }
          else if (a.type === "key") { await desktop.keyTap(a.key); }
          else if (a.type === "done") { done = true; break; }
          await new Promise((res) => setTimeout(res, 400));
        }
        if (done) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="agent-overlay" onClick={onClose}>
      <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
        <button className="agent-close" onClick={onClose}>✕</button>
        <h2>🖥️ Modo Co-work</h2>
        <p className="agent-sub">
          IsaBot verá tu pantalla y hará clicks/escribirá por ti. Puedes detenerla cerrando esta ventana.
        </p>
        <textarea
          className="agent-input"
          rows={3}
          placeholder="Ej: Abre mi Excel y exporta la primera hoja a PDF en Escritorio."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={running}
        />
        <button className="agent-run" onClick={runOnce} disabled={running || !task.trim()}>
          {running ? "🖱️ Ejecutando…" : "🚀 Ver mi pantalla y ayudarme"}
        </button>
        {error && <div className="agent-error">💔 {error}</div>}
        <div className="agent-steps">
          {log.map((s, i) => (
            <div key={i} className="agent-step result">
              <b>Paso {i + 1}:</b> {s.think}
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {s.actions.map((a) => a.type).join(" → ")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
