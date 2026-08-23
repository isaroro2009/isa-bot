import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReminder } from "@/lib/reminders.functions";
import { sendEmailWebhook } from "@/lib/emailWebhook.functions";
import { buildIsaBotPdf, type IsaPdfResult } from "@/lib/pdf-template";
import { useIbc } from "@/components/ibc/useIbc";

export type ReminderAction = {
  kind: "reminder";
  title: string;
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
};

export type EmailAction = {
  kind: "email";
  to: string;
  subject: string;
  body: string;
};

export type DocAction = {
  kind: "doc";
  prompt: string;
  email: boolean;
  to?: string;
};

export type ChatAction = ReminderAction | EmailAction | DocAction;

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mailtoHref(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** 📋 Botón de copiar texto con confirmación. */
export function CopyTextButton({ text, label = "📋 Copiar texto" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="action-card-btn ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* algunos navegadores lo bloquean */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "¡Copiado! 💕" : label}
    </button>
  );
}

/** ✉️ Respaldo manual: copiar el texto o abrir el cliente de correo. */
export function ManualSendActions({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  return (
    <div className="doc-preview-actions">
      <CopyTextButton text={`${subject}\n\n${body}`} />
      <a className="action-card-btn ghost" href={mailtoHref(to, subject, body)}>
        📧 Abrir cliente de correo
      </a>
    </div>
  );
}

export function DemoEmailModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="ibc-confirm-back" onClick={onClose}>
      <div className="ibc-confirm" onClick={(e) => e.stopPropagation()}>
        <h3>🧪 Modo manual</h3>
        <p>El mensaje está listo. Cópialo o ábrelo en tu app de correo para enviarlo tú misma.</p>
        <textarea
          readOnly
          value={text}
          style={{
            width: "100%",
            minHeight: 140,
            borderRadius: 12,
            border: "1.5px solid #ffd6eb",
            padding: 10,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        <div className="ibc-confirm-row">
          <button className="cancel" onClick={onClose}>Cerrar</button>
          <CopyTextButton text={text} />
        </div>
      </div>
    </div>
  );
}

export function ReminderActionCard({ action }: { action: ReminderAction }) {
  const save = useServerFn(createReminder);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  return (
    <div className="action-card">
      <div className="action-card-head">⏰ Nuevo recordatorio</div>
      <div className="action-card-rows">
        <div><span>Fecha</span><b>{action.date}</b></div>
        <div><span>Hora</span><b>{hhmm(action.hour, action.minute)}</b></div>
        <div><span>Mensaje</span><b>{action.title}</b></div>
      </div>
      {state === "done" ? (
        <div className="action-card-ok">✅ Guardado — te escribo al correo 💌</div>
      ) : (
        <button
          className="action-card-btn"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            try {
              await save({
                data: {
                  kind: "task",
                  title: action.title,
                  frequency: "once",
                  send_hour: action.hour,
                  send_minute: action.minute,
                  once_date: action.date,
                  scheduled_at: new Date(`${action.date}T${hhmm(action.hour, action.minute)}:00`).toISOString(),
                },
              });
              setState("done");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "No se pudo guardar");
              setState("error");
            }
          }}
        >
          {state === "busy" ? "Guardando…" : "💾 Guardar recordatorio"}
        </button>
      )}
      {state === "error" && <div className="action-card-err">{msg}</div>}
    </div>
  );
}

export function EmailActionCard({ action }: { action: EmailAction }) {
  const hook = useServerFn(sendEmailWebhook);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function dispatch() {
    setState("busy");
    try {
      const res = await hook({
        data: { recipient: action.to, subject: action.subject, body_text: action.body },
      });
      if (res.ok) return setState("done");
      setMsg(
        res.reason === "webhook_not_configured"
          ? "Aún no hay webhook de correo configurado — envíalo tú desde aquí 💌"
          : `El webhook no respondió (${res.reason}) — puedes enviarlo manualmente 💌`,
      );
      setState("error");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo enviar");
      setState("error");
    }
  }

  return (
    <div className="action-card">
      <div className="action-card-head">💌 Agente de correo</div>
      <div className="action-card-rows">
        <div><span>Para</span><b>{action.to}</b></div>
        <div><span>Asunto</span><b>{action.subject}</b></div>
        <div><span>Cuerpo</span><b className="action-card-body">{action.body}</b></div>
      </div>
      {state === "done" ? (
        <div className="action-card-ok">✅ Enviado al webhook de correo 💕</div>
      ) : (
        <button className="action-card-btn" disabled={state === "busy"} onClick={dispatch}>
          {state === "busy" ? "Enviando…" : "✅ Aprobar y enviar"}
        </button>
      )}
      {state === "error" && <div className="action-card-err">{msg}</div>}
      <ManualSendActions to={action.to} subject={action.subject} body={action.body} />
    </div>
  );
}

/** 🤖 Agente nativo en el chat: redacta, arma el PDF profesional y lo manda al webhook. */
export function DocActionCard({ action }: { action: DocAction }) {
  const ibc = useIbc();
  const hook = useServerFn(sendEmailWebhook);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [steps, setSteps] = useState<Record<string, "active" | "done" | "err">>({});
  const [pdf, setPdf] = useState<IsaPdfResult | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string>(action.to ?? "");
  const cost = ibc.costOf("agent");

  function mark(k: string, v: "active" | "done" | "err") {
    setSteps((prev) => ({ ...prev, [k]: v }));
  }

  async function run() {
    if (state === "busy") return;
    const paid = await ibc.confirmCharge("agent", "Documento PDF con el agente");
    if (!paid) return;
    setState("busy");
    setSteps({});
    setPdf(null);
    setSentTo(null);
    setMsg("");
    try {
      mark("brain", "active");
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      let body = "";
      try {
        const r = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            task: `${action.prompt}\n\nDevuelve un documento profesional, completo y bien estructurado, con títulos con "##" y viñetas con "-", listo para exportar a PDF.`,
          }),
        });
        if (r.ok) {
          const data = (await r.json()) as { answer?: string };
          body = (data.answer ?? "").trim();
        }
      } catch {
        /* seguimos con la plantilla local */
      }
      let fallbackNote = "";
      if (!body) {
        // 🛟 Plantilla local: el PDF siempre se crea, pase lo que pase.
        body = localDocTemplate(action.prompt);
        fallbackNote = "Creé el PDF con una plantilla local porque la IA no respondió — puedes editarlo y reintentar 💕";
      }
      mark("brain", "done");


      mark("doc", "active");
      const title = action.prompt.slice(0, 70);
      const built = await buildIsaBotPdf(title, body);
      setPdf(built);
      mark("doc", "done");

      if (action.email) {
        mark("mail", "active");
        const { data: userRes } = await supabase.auth.getUser();
        const to = action.to ?? userRes.user?.email ?? "";
        setRecipient(to);
        const res = await hook({
          data: {
            recipient: to,
            subject: title || "Tu documento de IsaBot",
            body_text: `${body}\n\n— Enviado con IsaBot ✨`,
            pdf_data: built.base64,
            pdf_name: built.filename,
          },
        });
        if (res.ok) {
          setSentTo(to);
          mark("mail", "done");
        } else {
          mark("mail", "err");
          setMsg(
            res.reason === "webhook_not_configured"
              ? "Sin webhook configurado — descarga el PDF y envíalo desde tu correo 💌"
              : `El webhook no respondió (${res.reason}) — puedes enviarlo manualmente 💌`,
          );
        }
      }
      if (fallbackNote) setMsg(fallbackNote);
      setState("done");

    } catch (e) {
      mark(steps["doc"] === "done" ? "mail" : "doc", "err");
      setMsg(e instanceof Error ? e.message : "Algo salió mal");
      setState("error");
      await ibc.giveBack();
    }
  }

  const badge = (k: string, label: string) => {
    const st = steps[k];
    if (!st) return null;
    return (
      <div key={k} className={`doc-badge ${st === "done" ? "done" : st === "err" ? "err" : "active"}`}>
        {st === "done" ? "✅" : st === "err" ? "✕" : "⏳"} {label}
      </div>
    );
  };

  const title = action.prompt.slice(0, 70);

  return (
    <div className="action-card">
      <div className="action-card-head">🤖 Agente de documentos</div>
      <div className="action-card-rows">
        <div><span>Tarea</span><b className="action-card-body">{action.prompt}</b></div>
        <div><span>Envío</span><b>{action.email ? (action.to ?? "tu correo registrado") : "solo PDF"}</b></div>
        <div><span>Costo</span><b>{cost === 0 ? "Gratis PRO" : `${cost} IBC`}</b></div>
      </div>

      {state !== "done" && (
        <button className="action-card-btn" disabled={state === "busy"} onClick={run}>
          {state === "busy" ? "Trabajando…" : `✅ Crear PDF${action.email ? " y enviar" : ""}`}
        </button>
      )}

      <div className="doc-badges">
        {badge("brain", "Agente IA: analizando tu petición")}
        {badge("doc", "PDF listo para ver y descargar")}
        {action.email && badge("mail", "Webhook de correo: enviando")}
      </div>

      {pdf && (
        <div className="doc-preview">
          <iframe title="Vista previa del PDF" src={pdf.dataUrl} />
          <div className="doc-preview-actions">
            <a className="action-card-btn" href={pdf.dataUrl} download={pdf.filename}>⬇️ Descargar PDF</a>
            <a className="action-card-btn ghost" href={pdf.dataUrl} target="_blank" rel="noopener noreferrer">
              🔍 Abrir en grande
            </a>
          </div>
          <ManualSendActions
            to={recipient}
            subject={title || "Tu documento de IsaBot"}
            body={`${pdf.text}\n\n— Creado con IsaBot ✨ (adjunta el PDF descargado)`}
          />
          {sentTo && <div className="action-card-ok">✅ Enviado a {sentTo} vía webhook 💕</div>}
        </div>
      )}

      {state === "error" && <div className="action-card-err">{msg}</div>}
      {state === "done" && msg && <div className="action-card-err">{msg}</div>}
    </div>
  );
}

export function ChatActionCardView({ action }: { action: ChatAction }) {
  if (action.kind === "reminder") return <ReminderActionCard action={action} />;
  if (action.kind === "doc") return <DocActionCard action={action} />;
  return <EmailActionCard action={action} />;
}
