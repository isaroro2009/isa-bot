import { useState } from "react";
import { useIbc } from "./useIbc";
import "./ibc.css";

type StepState = "pending" | "active" | "done";

const STEPS = [
  { key: "plan", label: "Analizando tu petición" },
  { key: "draft", label: "Redactando el documento" },
  { key: "pdf", label: "Generando el PDF" },
  { key: "mail", label: "Preparando el envío por correo" },
] as const;

/** 🤖 Agente autónomo: convierte una petición en un PDF descargable. */
export function AgentPdfPanel({ onClose }: { onClose: () => void }) {
  const ibc = useIbc();
  const [task, setTask] = useState("");
  const [email, setEmail] = useState("");
  const [states, setStates] = useState<Record<string, StepState>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cost = ibc.costOf("agent");

  function mark(key: string, s: StepState) {
    setStates((prev) => ({ ...prev, [key]: s }));
  }

  async function run() {
    if (!task.trim() || running) return;
    setError(null);
    setResult(null);
    setStates({});
    const paid = await ibc.charge("agent", "Agente autónomo (PDF)");
    if (!paid) return;

    setRunning(true);
    try {
      mark("plan", "active");
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      mark("plan", "done");
      mark("draft", "active");

      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          task:
            `${task.trim()}\n\nDevuelve un documento completo y bien estructurado, listo para exportar a PDF` +
            (email.trim() ? `. Destinatario previsto: ${email.trim()}` : "."),
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${r.status}`);
      }
      const data = (await r.json()) as { answer?: string };
      const body = (data.answer ?? "").trim();
      if (!body) throw new Error("El agente no devolvió contenido");
      mark("draft", "done");

      mark("pdf", "active");
      const title = task.trim().slice(0, 70);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 56;
      const width = doc.internal.pageSize.getWidth() - margin * 2;
      let y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      for (const line of doc.splitTextToSize(title, width) as string[]) {
        doc.text(line, margin, y);
        y += 24;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      y += 10;
      const clean = body.replace(/[*#`]/g, "");
      for (const line of doc.splitTextToSize(clean, width) as string[]) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 16;
      }
      doc.setFontSize(9);
      doc.text("Generado por IsaBot ✨", margin, doc.internal.pageSize.getHeight() - 30);
      doc.save(`isabot-${Date.now()}.pdf`);
      mark("pdf", "done");

      mark("mail", "active");
      await new Promise((res) => setTimeout(res, 600));
      mark("mail", "done");

      setResult({ title, body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal");
      await ibc.giveBack();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="ibc-root ibc-overlay" onClick={onClose}>
      <div className="ibc-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ibc-head">
          <h3>
            🤖 Agente autónomo
            <span className="ibc-cost-tag">{cost === 0 ? "Gratis PRO" : `${cost} IBC`}</span>
          </h3>
          <button className="ibc-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p style={{ opacity: 0.8, fontSize: ".88rem", marginTop: 0 }}>
          Dime qué necesitas y lo convierto en un documento PDF listo para enviar.
        </p>

        <textarea
          className="ibc-textarea"
          rows={4}
          placeholder="Ej: Crea una propuesta comercial de mis servicios de diseño para una cafetería en Cali."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={running}
        />
        <input
          className="ibc-textarea"
          style={{ marginTop: 10 }}
          placeholder="Correo del destinatario (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={running}
        />

        <button className="ibc-btn neon" onClick={run} disabled={running || !task.trim()}>
          {running ? "⚙️ Trabajando…" : `🚀 Ejecutar agente${cost > 0 ? ` · ${cost} IBC` : ""}`}
        </button>

        {(running || result) && (
          <ul className="ibc-agent-steps">
            {STEPS.map((s) => {
              const st = states[s.key] ?? "pending";
              return (
                <li key={s.key} className={`ibc-agent-step ${st}`}>
                  <span>{st === "done" ? "✅" : st === "active" ? "⏳" : "•"}</span>
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="ibc-empty-note">💔 {error} — te devolví tus coins.</p>}
        {result && (
          <p className="ibc-empty-note">
            📄 PDF descargado{email.trim() ? ` y listo para enviar a ${email.trim()}` : ""}. ¡Buen trabajo! 💜
          </p>
        )}
      </div>
    </div>
  );
}
