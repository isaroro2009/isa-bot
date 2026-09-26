import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getParentalStatus, setupParentPin, getParentReport, setGuideMode, type ParentReport } from "@/lib/parental.functions";
import "@/components/guide.css";

export const Route = createFileRoute("/_authenticated/padres")({
  head: () => ({
    meta: [
      { title: "Portal de Padres — IsaHaven" },
      { name: "description", content: "Control parental de IsaBot: resúmenes de actividad, modos de guía y bienestar emocional, respetando la privacidad de los chats." },
      { property: "og:title", content: "Portal de Padres — IsaHaven" },
      { property: "og:description", content: "Tranquilidad para familias: actividad, modo académico y bienestar de tus hijos en IsaBot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParentsPortal,
});

const MOOD: Record<string, string> = { feliz: "😄 Feliz", bien: "🙂 Bien", normal: "😐 Normal", confundida: "😕 Confundida/o", frustrada: "😣 Frustrada/o" };

function ParentsPortal() {
  const status = useServerFn(getParentalStatus);
  const setup = useServerFn(setupParentPin);
  const report = useServerFn(getParentReport);
  const saveMode = useServerFn(setGuideMode);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [unlockedPin, setUnlockedPin] = useState<string | null>(null);
  const [data, setData] = useState<ParentReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    status().then((s) => setConfigured(s.configured)).catch((e) => setErr(e.message));
  }, [status]);

  async function create() {
    setErr(null);
    if (pin !== pin2) return setErr("Las claves no coinciden");
    setBusy(true);
    try {
      await setup({ data: { pin } });
      setConfigured(true);
      await unlock(pin);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function unlock(p = pin) {
    setErr(null); setBusy(true);
    try {
      const r = await report({ data: { pin: p } });
      setData(r); setUnlockedPin(p); setPin(""); setPin2("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function changeMode(mode: "academico" | "libre") {
    if (!unlockedPin || !data) return;
    setBusy(true);
    try { await saveMode({ data: { pin: unlockedPin, mode } }); setData({ ...data, guideMode: mode }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const max = (arr: { count: number }[]) => Math.max(1, ...arr.map((a) => a.count));

  return (
    <div className="parent-page">
      <div className="parent-wrap">
        <div className="parent-card">
          <h2>👨‍👩‍👧 Portal de Padres</h2>
          <p className="parent-note">Visibilidad y tranquilidad sobre el uso de IsaBot. Por privacidad, <b>nunca</b> se muestran los chats individuales: solo resúmenes.</p>
          <Link to="/" className="parent-note">← Volver a IsaHaven</Link>
        </div>

        {configured === null && !err && <div className="parent-card">Cargando…</div>}

        {configured === false && (
          <div className="parent-card">
            <h3>🔐 Crea la clave de padres</h3>
            <p className="parent-note">Una clave numérica (4 a 8 dígitos) independiente de la cuenta. Guárdala solo tú.</p>
            <input className="parent-input" type="password" inputMode="numeric" maxLength={8} placeholder="Clave" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <br /><br />
            <input className="parent-input" type="password" inputMode="numeric" maxLength={8} placeholder="Repite la clave" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
            <br /><br />
            <button className="guide-btn" disabled={busy || pin.length < 4} onClick={create}>Crear y entrar</button>
          </div>
        )}

        {configured && !data && (
          <div className="parent-card">
            <h3>🔐 Ingresa la clave de padres</h3>
            <form onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
              <input className="parent-input" type="password" inputMode="numeric" maxLength={8} autoFocus placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              <br /><br />
              <button className="guide-btn" disabled={busy || pin.length < 4}>Entrar</button>
            </form>
          </div>
        )}

        {err && <p className="parent-err">⚠️ {err}</p>}

        {data && (
          <>
            <div className="parent-card">
              <h3>📊 Resumen de los últimos 30 días</h3>
              <div className="parent-grid">
                <div className="parent-kpi"><b>{data.activeDays}</b>días activos</div>
                <div className="parent-kpi"><b>{data.totalActions}</b>interacciones</div>
                <div className="parent-kpi"><b>{data.academy?.lessons ?? 0}</b>lecciones IsaAcademy</div>
                <div className="parent-kpi"><b>{data.academy?.streak ?? 0} 🔥</b>racha de estudio</div>
              </div>
            </div>

            <div className="parent-card">
              <h3>🧭 Áreas que explora</h3>
              {data.areas.length === 0 && <p className="parent-note">Aún no hay actividad registrada.</p>}
              {data.areas.map((a) => (
                <div key={a.label} className="parent-bar"><span>{a.label}</span><i style={{ width: `${(a.count / max(data.areas)) * 50}%` }} /><span>{a.count}</span></div>
              ))}
              {data.topics.length > 0 && (
                <>
                  <h3 style={{ marginTop: 14 }}>📚 Temas de aprendizaje</h3>
                  {data.topics.map((t) => (
                    <div key={t.topic} className="parent-bar"><span>{t.topic}</span><i style={{ width: `${(t.count / max(data.topics)) * 50}%` }} /><span>{t.count}</span></div>
                  ))}
                </>
              )}
            </div>

            <div className="parent-card">
              <h3>⏰ Hábitos de uso</h3>
              <div className="parent-grid">
                <div className="parent-kpi"><b>{data.hours.morning}</b>🌅 Mañana (6–12)</div>
                <div className="parent-kpi"><b>{data.hours.afternoon}</b>☀️ Tarde (12–18)</div>
                <div className="parent-kpi"><b>{data.hours.evening}</b>🌆 Noche (18–22)</div>
                <div className="parent-kpi"><b>{data.hours.night}</b>🌙 Madrugada (22–6)</div>
              </div>
              {data.hours.night > data.totalActions * 0.3 && data.totalActions > 5 && (
                <p className="parent-alert">🌙 Buena parte del uso ocurre de madrugada. Podría valer la pena conversar sobre rutinas de descanso.</p>
              )}
            </div>

            <div className="parent-card">
              <h3>🎛️ Modo de guía</h3>
              <div className="parent-modes">
                <button className={`parent-mode ${data.guideMode === "academico" ? "on" : ""}`} disabled={busy} onClick={() => changeMode("academico")}>
                  <b>📘 Modo Académico / Guiado</b>
                  <p className="parent-note">IsaBot no hace las tareas: guía con preguntas y pistas, fomenta el pensamiento crítico y usa lenguaje apto para su edad.</p>
                </button>
                <button className={`parent-mode ${data.guideMode === "libre" ? "on" : ""}`} disabled={busy} onClick={() => changeMode("libre")}>
                  <b>🎨 Modo Libre / Creativo</b>
                  <p className="parent-note">Experiencia completa de IsaBot para crear, explorar y conversar libremente.</p>
                </button>
              </div>
            </div>

            <div className="parent-card">
              <h3>💜 Bienestar emocional</h3>
              {data.moods.length === 0 && <p className="parent-note">Aún no hay check-ins emocionales este mes.</p>}
              {data.moods.map((m) => (
                <div key={m.mood} className="parent-bar"><span>{MOOD[m.mood] ?? m.mood}</span><i style={{ width: `${(m.count / max(data.moods)) * 50}%` }} /><span>{m.count}</span></div>
              ))}
              {data.alerts.length > 0 && (
                <>
                  <h3 style={{ marginTop: 14 }}>🔔 Alertas</h3>
                  {data.alerts.map((a, i) => (
                    <div key={i} className="parent-alert">
                      {MOOD[a.mood] ?? a.mood} · {new Date(a.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                      {a.hasNote ? " · dejó un comentario (privado)" : ""}
                    </div>
                  ))}
                  <p className="parent-note">Sugerencia: acércate con curiosidad y sin juicio; pregúntale cómo se siente con sus estudios.</p>
                </>
              )}
            </div>

            <button className="guide-btn ghost" onClick={() => { setData(null); setUnlockedPin(null); }}>🔒 Cerrar portal</button>
          </>
        )}
      </div>
    </div>
  );
}
