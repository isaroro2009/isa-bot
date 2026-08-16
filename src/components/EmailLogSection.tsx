import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listEmailLog, sendPendingWelcomes, sendTestEmail, type EmailLogRow, type MailStatus } from "@/lib/admin.functions";


const KIND_LABEL: Record<string, string> = {
  welcome: "💜 Bienvenida",
  reminder: "⏰ Recordatorio",
  inactivity: "💕 Te extraño",
  weekly_gift: "🎁 Regalo semanal",
  weekly_feedback: "💡 Feedback semanal",
  other: "✨ Otro",
};

export function EmailLogSection() {
  const fetchLog = useServerFn(listEmailLog);
  const runPending = useServerFn(sendPendingWelcomes);
  const runTest = useServerFn(sendTestEmail);
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [pending, setPending] = useState(0);
  const [, setMailConfigured] = useState(true);
  const [mail, setMail] = useState<MailStatus | null>(null);
  const [testing, setTesting] = useState(false);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailLogRow | null>(null);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLog();
      setRows(res.rows);
      setPending(res.pendingWelcome);
      setMailConfigured(res.mailConfigured);
      setMail(res.mail);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function testEmail() {
    setTesting(true);
    setResult(null);
    setError(null);
    try {
      const r = await runTest({ data: {} });
      setResult(
        r.sent
          ? `✅ Correo de prueba enviado a ${r.to}. Revisa tu bandeja (y spam).`
          : `⚠️ No se pudo enviar a ${r.to || "tu correo"}: ${r.reason}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }


  async function sendPending() {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const r = await runPending();
      setResult(
        r.reason === "email_not_configured"
          ? `⚠️ No se envió nada: el correo del proyecto aún no está configurado (${r.total} pendientes).`
          : `✅ ${r.sent} bienvenidas enviadas · ⚠️ ${r.failed} fallidas (de ${r.total} pendientes).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.length - sent;
  const welcomes = rows.filter((r) => r.kind === "welcome" && r.status === "sent").length;
  const visible = filter === "all" ? rows : rows.filter((r) => r.kind === filter);


  return (
    <div
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        boxShadow: "0 10px 40px rgba(255,133,162,0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: "#7a3fbf", fontSize: 18 }}>📧 Correos que envió IsaBot</h2>
          <p style={{ margin: "4px 0 0", color: "#a06b8a", fontSize: 13 }}>
            {rows.length} registros · {sent} enviados · {failed} fallidos · {welcomes} bienvenidas ·{" "}
            {pending} usuarias sin bienvenida aún
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={sendPending}
            disabled={sending || pending === 0}
            style={{ padding: "8px 14px", background: "linear-gradient(135deg,#c9a0e8,#f0b8c8)", border: "none", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: pending === 0 ? "default" : "pointer", color: "#3d2450", opacity: sending || pending === 0 ? 0.6 : 1 }}
          >
            {sending ? "Enviando…" : `💌 Enviar bienvenidas pendientes (${pending})`}
          </button>
          <button
            onClick={testEmail}
            disabled={testing}
            style={{ padding: "8px 14px", background: "white", border: "1.5px solid #e9d5ff", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#6b46c1", opacity: testing ? 0.6 : 1 }}
          >
            {testing ? "Probando…" : "✉️ Correo de prueba"}
          </button>
          <button
            onClick={load}
            style={{ padding: "8px 14px", background: "white", border: "1.5px solid #e9d5ff", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#6b46c1" }}
          >
            {loading ? "…" : "🔄 Actualizar"}
          </button>
          <button
            onClick={() => setOpen(!open)}
            style={{ padding: "8px 14px", background: "white", border: "1.5px solid #e9d5ff", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#6b46c1" }}
          >
            {open ? "Ocultar" : "Ver correos"}
          </button>
        </div>
      </div>

      {mail && (
        <p style={{ margin: "12px 0 0", padding: "10px 14px", borderRadius: 16, background: mail.configured ? "#eefbf2" : "#fff4e5", color: mail.configured ? "#1c6b42" : "#8a5a00", fontSize: 13, fontWeight: 600 }}>
          {mail.configured ? (
            <>
              ✅ Correo activo con <strong>{mail.provider === "brevo" ? "Brevo" : "Resend"}</strong> ·
              remitente <strong>{mail.from}</strong>. Usa “Correo de prueba” para confirmar que llega.
            </>
          ) : (
            <>
              ⚠️ El correo aún no está activo: {mail.reason}
              <br />
              Pasos (5 minutos, sin permisos de workspace y sin tocar DNS):
              <br />
              1) Crea una cuenta gratis en <strong>brevo.com</strong> · 2) Settings → <strong>Senders</strong> →
              añade y confirma <strong>{mail.from}</strong> desde el correo que te llega · 3) Settings →
              <strong> SMTP &amp; API</strong> → crea una API key v3 y pégala aquí en IsaBot como{" "}
              <strong>BREVO_API_KEY</strong>.
            </>
          )}
        </p>
      )}


      {result && <p style={{ color: "#6b46c1", fontSize: 13, fontWeight: 700 }}>{result}</p>}
      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}


      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {["all", ...Object.keys(KIND_LABEL)].map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1.5px solid #e9d5ff",
                  background: filter === k ? "linear-gradient(135deg,#c9a0e8,#f0b8c8)" : "white",
                  color: filter === k ? "#3d2450" : "#6b46c1",
                }}
              >
                {k === "all" ? "Todos" : KIND_LABEL[k]}
              </button>
            ))}
          </div>

          {visible.length === 0 && (
            <p style={{ color: "#a06b8a", fontSize: 13 }}>
              Todavía no hay correos registrados aquí 🌸 (se registran desde ahora en adelante)
            </p>
          )}

          <div style={{ overflowX: "auto" }} className="admin-table-wrap">
            {visible.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#a06b8a" }}>
                    <th style={{ padding: 8 }}>Fecha</th>
                    <th style={{ padding: 8 }}>Tipo</th>
                    <th style={{ padding: 8 }}>Para</th>
                    <th style={{ padding: 8 }}>Asunto</th>
                    <th style={{ padding: 8 }}>Estado</th>
                    <th style={{ padding: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #f3e8ff" }}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                        {new Date(r.created_at).toLocaleString("es")}
                      </td>
                      <td style={{ padding: 8 }}>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td style={{ padding: 8 }}>{r.recipient}</td>
                      <td style={{ padding: 8 }}>{r.subject}</td>
                      <td style={{ padding: 8 }}>
                        {r.status === "sent" ? "✅ Enviado" : `⚠️ ${r.reason ?? "falló"}`}
                      </td>
                      <td style={{ padding: 8 }}>
                        {r.html && (
                          <button
                            onClick={() => setPreview(r)}
                            style={{ padding: "5px 10px", borderRadius: 999, border: "1.5px solid #e9d5ff", background: "white", color: "#6b46c1", fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                          >
                            👀 Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div
            className="settings-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 620, width: "92vw" }}
          >
            <h3>{preview.subject}</h3>
            <p className="habits-sub">
              {KIND_LABEL[preview.kind] ?? preview.kind} · {preview.recipient} ·{" "}
              {new Date(preview.created_at).toLocaleString("es")}
            </p>
            <iframe
              title="Vista previa del correo"
              srcDoc={preview.html ?? ""}
              sandbox=""
              style={{ width: "100%", height: "55vh", border: "1.5px solid #f3e8ff", borderRadius: 16, background: "white" }}
            />
            <button className="close-settings" onClick={() => setPreview(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
