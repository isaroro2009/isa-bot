import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReminder } from "@/lib/reminders.functions";
import { sendEmailNotification } from "@/lib/notify.functions";
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

/** Modal de "modo demo" cuando el envío de correo no está configurado. */
function isNotConfigured(reason?: string) {
  return Boolean(reason && /email_not_configured|no_provider|not_configured|BREVO/i.test(reason));
}

export function DemoEmailModal({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ibc-confirm-back" onClick={onClose}>
      <div className="ibc-confirm" onClick={(e) => e.stopPropagation()}>
        <h3>🧪 Modo Demo Activo</h3>
        <p>
          El mensaje fue generado correctamente pero requiere configurar
          <b> BREVO_API_KEY</b> en Secrets para el envío real.
        </p>
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
          <button
            className="ok"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* algunos navegadores lo bloquean */
              }
              setCopied(true);
            }}
          >
            {copied ? "¡Copiado! 💕" : "📋 Copiar texto"}
          </button>
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
  const send = useServerFn(sendEmailNotification);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [demo, setDemo] = useState(false);

  return (
    <div className="action-card">
      <div className="action-card-head">💌 Agente de correo</div>
      <div className="action-card-rows">
        <div><span>Para</span><b>{action.to}</b></div>
        <div><span>Asunto</span><b>{action.subject}</b></div>
        <div><span>Cuerpo</span><b className="action-card-body">{action.body}</b></div>
      </div>
      {state === "done" ? (
        <div className="action-card-ok">✅ Correo enviado 💕</div>
      ) : (
        <button
          className="action-card-btn"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            try {
              const res = await send({ data: { to: action.to, subject: action.subject, body: action.body } });
              if (res.sent) setState("done");
              else if (isNotConfigured(res.reason)) {
                setDemo(true);
                setMsg("Modo demo: el correo no está configurado todavía.");
                setState("error");
              } else { setMsg(`No se pudo enviar (${res.reason})`); setState("error"); }
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "No se pudo enviar");
              setState("error");
            }
          }}
        >
          {state === "busy" ? "Enviando…" : "✅ Aprobar y enviar"}
        </button>
      )}
      {state === "error" && <div className="action-card-err">{msg}</div>}
      {demo && (
        <DemoEmailModal
          text={`${action.subject}\n\n${action.body}`}
          onClose={() => setDemo(false)}
        />
      )}
    </div>
  );
}

/** 🤖 Agente nativo en el chat: redacta, arma el PDF y lo envía por correo. */
export function DocActionCard({ action }: { action: DocAction }) {
  const ibc = useIbc();
  const send = useServerFn(sendEmailNotification);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [steps, setSteps] = useState<Record<string, "active" | "done" | "err">>({});
  const [demoText, setDemoText] = useState<string | null>(null);
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
    try {
      mark("doc", "active");
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          task: `${action.prompt}\n\nDevuelve un documento completo y bien estructurado, listo para exportar a PDF.`,
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${r.status}`);
      }
      const data = (await r.json()) as { answer?: string };
      const body = (data.answer ?? "").trim();
      if (!body) throw new Error("El agente no devolvió contenido");

      const title = action.prompt.slice(0, 70);
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
      for (const line of doc.splitTextToSize(body.replace(/[*#`]/g, ""), width) as string[]) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 16;
      }
      doc.text("Generado por IsaBot ✨", margin, doc.internal.pageSize.getHeight() - 30);
      doc.save(`isabot-${Date.now()}.pdf`);
      mark("doc", "done");

      if (action.email) {
        mark("mail", "active");
        const { data: userRes } = await supabase.auth.getUser();
        const to = action.to ?? userRes.user?.email ?? "";
        if (!to) throw new Error("No encontré tu correo registrado");
        const res = await send({ data: { to, subject: title || "Tu documento de IsaBot", body } });
        if (!res.sent) {
          if (isNotConfigured(res.reason)) {
            mark("mail", "err");
            setDemoText(`${title}\n\n${body}`);
            setState("done");
            return;
          }
          throw new Error(`No se pudo enviar (${res.reason})`);
        }
        mark("mail", "done");
      }
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
      <div key={k} className={`doc-badge ${st === "done" ? "done" : st === "err" ? "err" : ""}`}>
        {st === "done" ? "[✓]" : st === "err" ? "[✕]" : "[…]"} {label}
      </div>
    );
  };

  return (
    <div className="action-card">
      <div className="action-card-head">🤖 Agente de documentos</div>
      <div className="action-card-rows">
        <div><span>Tarea</span><b className="action-card-body">{action.prompt}</b></div>
        <div><span>Envío</span><b>{action.email ? (action.to ?? "tu correo registrado") : "solo descarga"}</b></div>
        <div><span>Costo</span><b>{cost === 0 ? "Gratis PRO" : `${cost} IBC`}</b></div>
      </div>
      {state !== "done" && (
        <button className="action-card-btn" disabled={state === "busy"} onClick={run}>
          {state === "busy" ? "Trabajando…" : `✅ Crear PDF${action.email ? " y enviar" : ""}`}
        </button>
      )}
      <div className="doc-badges">
        {badge("doc", "Documento PDF creado")}
        {action.email && badge("mail", "Correo enviado exitosamente")}
      </div>
      {state === "error" && <div className="action-card-err">{msg}</div>}
      {demoText && <DemoEmailModal text={demoText} onClose={() => setDemoText(null)} />}
    </div>
  );
}

export function ChatActionCardView({ action }: { action: ChatAction }) {
  if (action.kind === "reminder") return <ReminderActionCard action={action} />;
  if (action.kind === "doc") return <DocActionCard action={action} />;
  return <EmailActionCard action={action} />;
}
