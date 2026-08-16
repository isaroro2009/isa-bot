import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyReminders,
  createReminder,
  toggleReminder,
  deleteReminder,
  getEmailPrefs,
  setEmailPrefs,
  type Reminder,
} from "@/lib/reminders.functions";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function RemindersPanel({ onClose }: { onClose: () => void }) {
  const fetchList = useServerFn(listMyReminders);
  const add = useServerFn(createReminder);
  const toggle = useServerFn(toggleReminder);
  const remove = useServerFn(deleteReminder);
  const fetchPrefs = useServerFn(getEmailPrefs);
  const savePrefs = useServerFn(setEmailPrefs);

  const [items, setItems] = useState<Reminder[]>([]);
  const [emails, setEmails] = useState(true);
  const [inactivity, setInactivity] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<"habit" | "task">("habit");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"once" | "daily" | "weekly">("daily");
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [weekday, setWeekday] = useState("1");

  async function reload() {
    try {
      const [l, p] = await Promise.all([fetchList(), fetchPrefs()]);
      setItems(l);
      setEmails(p.enabled);
      setInactivity(p.inactivity);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleAdd() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await add({ data: {
        kind,
        title: title.trim(),
        frequency,
        send_hour: parseInt(hour, 10) || 9,
        send_minute: parseInt(minute, 10) || 0,
        weekday: frequency === "weekly" ? parseInt(weekday, 10) : null,
        once_date: frequency === "once" ? new Date().toISOString().slice(0, 10) : null,
      }});
      setTitle("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <h3>⏰ Recordatorios por correo</h3>
        <p className="habits-sub">
          IsaBot te escribe al correo cuando toca tu hábito o tarea. También puedes pedírselo en el chat:
          <i> «recuérdame tomar agua todos los días a las 9»</i>.
        </p>

        <label className="reminder-mail-toggle">
          <input
            type="checkbox"
            checked={emails}
            onChange={async (e) => {
              const v = e.target.checked;
              setEmails(v);
              try { await savePrefs({ data: { enabled: v } }); } catch { /* noop */ }
            }}
          />
          <span>💌 Recibir recordatorios por correo</span>
        </label>

        <label className="reminder-mail-toggle">
          <input
            type="checkbox"
            checked={inactivity}
            onChange={async (e) => {
              const v = e.target.checked;
              setInactivity(v);
              try { await savePrefs({ data: { inactivity: v } }); } catch { /* noop */ }
            }}
          />
          <span>🔔 Notificaciones de inactividad (estilo Duolingo)</span>
        </label>


        {error && <div className="rewards-error">{error}</div>}

        <div className="reminder-form">
          <div className="reminder-row">
            <select value={kind} onChange={(e) => setKind(e.target.value as "habit" | "task")}>
              <option value="habit">🌱 Hábito</option>
              <option value="task">⏰ Tarea</option>
            </select>
            <input placeholder="¿Qué recordar?" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="reminder-row">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as "once" | "daily" | "weekly")}>
              <option value="daily">Cada día</option>
              <option value="weekly">Cada semana</option>
              <option value="once">Solo hoy</option>
            </select>
            {frequency === "weekly" && (
              <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            )}
            <input type="number" min="0" max="23" value={hour} onChange={(e) => setHour(e.target.value)} style={{ maxWidth: 70 }} />
            <input type="number" min="0" max="59" step="5" value={minute} onChange={(e) => setMinute(e.target.value)} style={{ maxWidth: 70 }} />
          </div>
          <button className="reminder-btn" disabled={busy} onClick={handleAdd}>
            {busy ? "Guardando…" : "➕ Crear recordatorio"}
          </button>
        </div>

        <div className="active-reminders">
          {loading && <div className="reminder-item">Cargando…</div>}
          {!loading && items.length === 0 && <div className="reminder-item">Aún no tienes recordatorios 🌸</div>}
          {items.map((r) => (
            <div key={r.id} className="reminder-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, opacity: r.active ? 1 : 0.5 }}>
                {r.kind === "habit" ? "🌱" : "⏰"} {r.title} ·{" "}
                {r.frequency === "daily" ? "cada día" : r.frequency === "weekly" ? DAYS[r.weekday ?? 1] : "una vez"} a las{" "}
                {String(r.send_hour).padStart(2, "0")}:{String(r.send_minute).padStart(2, "0")}
              </span>
              <button
                className="chat-item-btn"
                title={r.active ? "Pausar" : "Activar"}
                onClick={async () => { await toggle({ data: { id: r.id, active: !r.active } }); reload(); }}
              >
                {r.active ? "⏸️" : "▶️"}
              </button>
              <button
                className="chat-item-btn"
                title="Eliminar"
                onClick={async () => { await remove({ data: { id: r.id } }); reload(); }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <button className="close-settings" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
