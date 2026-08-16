import { useState } from "react";
import { ISABOT_MODEL_LABEL } from "@/lib/branding";

type AgentStep =
  | { kind: "thought"; text: string }
  | { kind: "tool_call"; tool: string; input: string }
  | { kind: "tool_result"; tool: string; summary: string }
  | { kind: "final"; text: string; sources: Array<{ title: string; url: string }> };

type AgentResponse = {
  steps: AgentStep[];
  answer: string;
  sources: Array<{ title: string; url: string }>;
};

export function AgentPanel({ onClose }: { onClose: () => void }) {
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResponse | null>(null);

  async function run() {
    if (!task.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ task: task.trim(), brain: localStorage.getItem("isabot_brain") ?? undefined }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${r.status}`);
      }
      setResult((await r.json()) as AgentResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="agent-overlay" onClick={onClose}>
      <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
        <button className="agent-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="agent-header">
          <h2>🤖 Modo Agente</h2>
          <p className="agent-sub">
            IsaBot actúa sola: busca en la web, lee fuentes, <b>envía correos por ti</b> y crea recordatorios.
            Motor: <b>{ISABOT_MODEL_LABEL}</b>.
          </p>
        </div>

        <textarea
          className="agent-input"
          placeholder="Ej: Escribe y envía un correo a hola@negocio.com presentando mis servicios de diseño, y recuérdame hacer seguimiento mañana a las 9."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          disabled={loading}
        />

        <button className="agent-run" onClick={run} disabled={loading || !task.trim()}>
          {loading ? "🔎 Ejecutando…" : "🚀 Ejecutar agente"}
        </button>

        {error && <div className="agent-error">💔 {error}</div>}

        {loading && !result && (
          <div className="agent-steps">
            <div className="agent-step thinking">Pensando la mejor forma de buscar…</div>
            <div className="agent-step thinking">Consultando la web en vivo…</div>
            <div className="agent-step thinking">Sintetizando la respuesta con citas…</div>
          </div>
        )}

        {result && (
          <>
            <div className="agent-steps">
              {result.steps.map((s, i) => {
                if (s.kind === "thought")
                  return <div key={i} className="agent-step thought">💭 {s.text}</div>;
                if (s.kind === "tool_call")
                  return (
                    <div key={i} className="agent-step call">
                      {s.tool === "web_search"
                        ? "🔎"
                        : s.tool === "fetch_page"
                          ? "📄"
                          : s.tool === "send_email"
                            ? "📤"
                            : s.tool === "create_reminder"
                              ? "⏰"
                              : "🛠️"}{" "}
                      <b>{s.tool}</b>: <span>{s.input}</span>
                    </div>
                  );
                if (s.kind === "tool_result")
                  return (
                    <div key={i} className="agent-step result">
                      ✅ {s.tool} → {s.summary}
                    </div>
                  );
                return null;
              })}
            </div>

            <div className="agent-answer">
              {result.answer.split(/\n\n+/).map((para, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{para}</p>
              ))}
            </div>

            {result.sources.length > 0 && (
              <div className="agent-sources">
                <h4>🔗 Fuentes</h4>
                <ol>
                  {result.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
