import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getTodayPlan,
  createTodayPlan,
  setBlockStatus,
  closeTodayPlan,
  type DailyPlan,
  type PlanBlock,
} from "@/lib/dailyPlan.functions";

const ENERGIES: Array<{ key: "low" | "normal" | "high"; label: string }> = [
  { key: "low", label: "🥱 Poca" },
  { key: "normal", label: "🙂 Normal" },
  { key: "high", label: "⚡ Mucha" },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DailyPlanPanel({
  onClose,
  onPlanChanged,
}: {
  onClose: () => void;
  onPlanChanged?: (plan: DailyPlan | null) => void;
}) {
  const load = useServerFn(getTodayPlan);
  const create = useServerFn(createTodayPlan);
  const setStatus = useServerFn(setBlockStatus);
  const close = useServerFn(closeTodayPlan);

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState("");
  const [energy, setEnergy] = useState<"low" | "normal" | "high">("normal");
  const [minutes, setMinutes] = useState(120);

  // Modo Foco
  const [focusBlock, setFocusBlock] = useState<PlanBlock | null>(null);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const startedRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const p = await load();
      setPlan(p);
      onPlanChanged?.(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          setRunning(false);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  async function generate() {
    if (goal.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const p = await create({ data: { goal: goal.trim(), energy, minutes } });
      setPlan(p);
      onPlanChanged?.(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function mark(block: PlanBlock, status: PlanBlock["status"], focusMinutes?: number) {
    try {
      await setStatus({ data: { blockId: block.id, status, focusMinutes } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function openFocus(b: PlanBlock) {
    setFocusBlock(b);
    setLeft(b.minutes * 60);
    startedRef.current = Date.now();
    setRunning(true);
    void mark(b, "doing");
  }

  async function finishFocus(completed: boolean) {
    if (!focusBlock) return;
    const spent = Math.round((Date.now() - startedRef.current) / 60000);
    setRunning(false);
    const b = focusBlock;
    setFocusBlock(null);
    await mark(b, completed ? "done" : "pending", Math.max(0, Math.min(spent, b.minutes)));
  }

  const doneCount = plan?.blocks.filter((b) => b.status === "done").length ?? 0;
  const totalTasks = plan?.blocks.filter((b) => b.kind === "task").length ?? 0;
  const progress = totalTasks ? Math.round((plan!.blocks.filter((b) => b.kind === "task" && b.status === "done").length / totalTasks) * 100) : 0;

  if (focusBlock) {
    return (
      <div className="modal-overlay focus-overlay">
        <div className="focus-card" onClick={(e) => e.stopPropagation()}>
          <div className="focus-label">Modo Foco 🎯</div>
          <h2 className="focus-title">{focusBlock.title}</h2>
          <div className="focus-timer">{fmt(left)}</div>
          <div className="focus-actions">
            <button className="focus-btn ghost" onClick={() => setRunning((r) => !r)}>
              {running ? "⏸️ Pausar" : "▶️ Seguir"}
            </button>
            <button className="focus-btn ghost" onClick={() => void finishFocus(false)}>← Salir</button>
            <button className="focus-btn main" onClick={() => void finishFocus(true)}>✅ Terminé</button>
          </div>
          <p className="focus-tip">
            {left === 0
              ? "¡Se acabó el bloque! Marca si lo lograste 💜"
              : "Nada de pestañas nuevas. Solo esto, solo ahora."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card myday-card" onClick={(e) => e.stopPropagation()}>
        <h3>🚀 Mi Día con IsaBot</h3>
        <p className="habits-sub">
          Cuéntame tu meta de hoy y te armo un plan real con bloques de foco y descansos.
          Yo te acompaño bloque por bloque.
        </p>

        {error && <div className="rewards-error">{error}</div>}
        {loading && <div className="reminder-item">Cargando tu día…</div>}

        {!loading && !plan && (
          <div className="myday-form">
            <input
              className="myday-goal"
              placeholder="¿Qué es lo MÁS importante hoy? ej: terminar el ensayo de biología"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={240}
            />
            <div className="myday-row">
              <span className="myday-lbl">Energía</span>
              <div className="myday-chips">
                {ENERGIES.map((e) => (
                  <button
                    key={e.key}
                    className={`myday-chip ${energy === e.key ? "active" : ""}`}
                    onClick={() => setEnergy(e.key)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="myday-row">
              <span className="myday-lbl">Tiempo</span>
              <div className="myday-chips">
                {[60, 120, 180, 240].map((m) => (
                  <button
                    key={m}
                    className={`myday-chip ${minutes === m ? "active" : ""}`}
                    onClick={() => setMinutes(m)}
                  >
                    {m / 60} h
                  </button>
                ))}
              </div>
            </div>
            <button className="reminder-btn" disabled={busy || goal.trim().length < 3} onClick={generate}>
              {busy ? "Armando tu día… ✨" : "✨ Armar mi día"}
            </button>
          </div>
        )}

        {!loading && plan && (
          <>
            <div className="myday-head">
              <div>
                <div className="myday-goal-txt">🌟 {plan.main_goal}</div>
                <div className="myday-meta">
                  {doneCount}/{plan.blocks.length} bloques · {plan.focus_minutes} min de foco ·
                  {" "}🔥 racha {plan.streak} día{plan.streak === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="myday-progress"><div style={{ width: `${progress}%` }} /></div>

            <div className="myday-blocks">
              {plan.blocks.map((b) => (
                <div key={b.id} className={`myday-block ${b.kind} ${b.status}`}>
                  <div className="myday-block-main">
                    <div className="myday-block-title">{b.title}</div>
                    <div className="myday-block-sub">{b.minutes} min · {
                      b.status === "done" ? "hecho ✅" : b.status === "skipped" ? "saltado" : b.status === "doing" ? "en curso…" : "pendiente"
                    }</div>
                  </div>
                  {b.status !== "done" && (
                    <>
                      {b.kind === "task" && (
                        <button className="myday-go" onClick={() => openFocus(b)}>🎯 Enfocar</button>
                      )}
                      <button className="chat-item-btn" title="Marcar como hecho" onClick={() => void mark(b, "done", b.minutes)}>✅</button>
                      <button className="chat-item-btn" title="Saltar" onClick={() => void mark(b, "skipped")}>⏭️</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {plan.status === "closed" && plan.recap && (
              <div className="myday-recap">
                <b>🌙 Cierre del día</b>
                <p>{plan.recap}</p>
              </div>
            )}

            <div className="myday-footer">
              <button
                className="reminder-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await close();
                    await refresh();
                    setPlan((p) => (p ? { ...p, recap: r.recap, status: "closed", streak: r.streak } : p));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                🌙 Cerrar mi día
              </button>
              <button
                className="chat-item-btn"
                title="Rehacer el plan de hoy"
                onClick={() => { setPlan(null); setGoal(""); }}
              >
                🔄 Rehacer
              </button>
            </div>
          </>
        )}

        <button className="close-settings" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
