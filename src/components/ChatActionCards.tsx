import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReminder } from "@/lib/reminders.functions";
import { sendEmailNotification } from "@/lib/notify.functions";

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

export type ChatAction = ReminderAction | EmailAction;

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
              else { setMsg(`No se pudo enviar (${res.reason})`); setState("error"); }
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
    </div>
  );
}

export function ChatActionCardView({ action }: { action: ChatAction }) {
  return action.kind === "reminder"
    ? <ReminderActionCard action={action} />
    : <EmailActionCard action={action} />;
}
