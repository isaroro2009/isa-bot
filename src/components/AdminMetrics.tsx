import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAdminMetrics, type MetricsResponse } from "@/lib/analytics.functions";
import { getPresence, type PresenceUser } from "@/lib/presence.functions";


const EVENT_LABELS: Record<string, string> = {
  message_sent: "💬 envió mensaje",
  image_generated: "🎨 generó imagen",
  voice_call_started: "📞 inició llamada",
  voice_call_ended: "📞 terminó llamada",
  feature_opened: "🧩 abrió feature",
  premium_activated: "✨ activó premium",
  user_signed_up: "🆕 se registró",
};

function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    const from = start.current;
    const to = value;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else start.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function AdminMetrics() {

  const fetchMetrics = useServerFn(getAdminMetrics);
  const fetchPresence = useServerFn(getPresence);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [presence, setPresence] = useState<{ online: number; users: PresenceUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const [m, p] = await Promise.all([
        fetchMetrics(),
        fetchPresence().catch(() => null),
      ]);
      setData(m);
      if (p) setPresence(p);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  if (error && !data) {
    return (
      <div style={{ background: "#ffe0ec", color: "#c92a5a", padding: 12, borderRadius: 12 }}>
        No se pudieron cargar las métricas: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={card}>
        <p style={{ color: "#a06b8a", margin: 0 }}>Cargando métricas... ✨</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...card, padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#22c55e",
                boxShadow: "0 0 0 0 rgba(34,197,94,0.7)",
                animation: "isabot-live-pulse 1.6s ease-out infinite",
              }}
            />
            <strong style={{ color: "#7a3fbf" }}>En vivo</strong>
            <span style={{ color: "#a06b8a", fontSize: 12 }}>
              {lastUpdate
                ? `actualizado ${lastUpdate.toLocaleTimeString()}`
                : "conectando..."}
              {refreshing ? " · sincronizando..." : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={load} style={btnGhost}>
              🔄 Refrescar
            </button>
          </div>

        </div>
      </div>

      <KpiRow k={data.kpis} />

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <ChartCard title="💬 Mensajes por día (14d)" accent="#ff477e">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.messagesByDay}>
              <defs>
                <linearGradient id="msgLine" x1="0" x2="1">
                  <stop offset="0%" stopColor="#ff85a2" />
                  <stop offset="100%" stopColor="#a58eff" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffd6eb" />
              <XAxis dataKey="date" stroke="#a06b8a" fontSize={11} />
              <YAxis stroke="#a06b8a" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="url(#msgLine)"
                strokeWidth={3}
                dot={{ r: 3, fill: "#ff477e" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="🆕 Nuevos registros por día (14d)" accent="#7a3fbf">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.signupsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0c3ff" />
              <XAxis dataKey="date" stroke="#a06b8a" fontSize={11} />
              <YAxis stroke="#a06b8a" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.signupsByDay.map((_, i) => (
                  <Cell key={i} fill={i % 2 ? "#a58eff" : "#c9b6ff"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <ChartCard title="🕐 Horas pico de uso (7d, UTC)" accent="#0ea5e9">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.hourlyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cfeaff" />
              <XAxis dataKey="hour" stroke="#a06b8a" fontSize={10} interval={2} />
              <YAxis stroke="#a06b8a" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.hourlyUsage.map((h, i) => {
                  const max = Math.max(...data.hourlyUsage.map((x) => x.count), 1);
                  return <Cell key={i} fill={h.count === max && max > 0 ? "#ff477e" : "#7dd3fc"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="🏷️ Temas más preguntados (7d)" accent="#7a3fbf">
          {data.topTopics.length === 0 ? (
            <p style={emptyText}>Aún no hay temas suficientes 💕</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.topTopics.map((t) => {
                const max = Math.max(...data.topTopics.map((x) => x.count), 1);
                return (
                  <div key={t.topic}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", marginBottom: 4 }}>
                      <span>{t.topic}</span>
                      <strong style={{ color: "#7a3fbf" }}>{t.count}</strong>
                    </div>
                    <div style={{ height: 10, background: "#f2ebff", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(t.count / max) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg,#a58eff,#7a3fbf)",
                          transition: "width .6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title={`🟢 Usuarios en vivo${presence ? ` · ${presence.online} en línea` : ""}`} accent="#22c55e">
          {!presence || presence.users.length === 0 ? (
            <p style={emptyText}>Sin datos de presencia todavía ✨</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {presence.users.slice(0, 12).map((u) => (
                <li
                  key={u.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 13,
                    padding: "6px 10px",
                    background: u.online ? "#ecfdf5" : "#faf5ff",
                    borderRadius: 10,
                  }}
                >
                  <span style={{ color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.online ? "🟢" : "⚪"} <strong>{u.name}</strong>
                  </span>
                  <span style={{ color: "#a06b8a", whiteSpace: "nowrap" }}>
                    {u.online ? "en línea" : u.last_seen_at ? timeAgo(u.last_seen_at) : "nunca"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>



      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <ChartCard title="🧩 Uso de features (7d)" accent="#ff85a2">
          {data.featureUsage.length === 0 ? (
            <p style={emptyText}>Aún no hay eventos de features 💕</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(() => {
                const max = Math.max(...data.featureUsage.map((f) => f.count), 1);
                return data.featureUsage.map((f) => (
                  <div key={f.feature}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        color: "#555",
                        marginBottom: 4,
                      }}
                    >
                      <span>{f.feature}</span>
                      <strong style={{ color: "#ff477e" }}>{f.count}</strong>
                    </div>
                    <div
                      style={{
                        height: 10,
                        background: "#fdeaf3",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(f.count / max) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg,#ff85a2,#a58eff)",
                          transition: "width .6s ease",
                        }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </ChartCard>

        <ChartCard title="👑 Top usuarios (7d)" accent="#a17300">
          {data.topUsers.length === 0 ? (
            <p style={emptyText}>Aún no hay actividad suficiente 💕</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {data.topUsers.map((u) => (
                <li key={u.email} style={{ fontSize: 14, color: "#333" }}>
                  <strong>{u.name || u.email}</strong>{" "}
                  <span style={{ color: "#a06b8a", fontSize: 12 }}>
                    · {u.count} mensajes
                  </span>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>

        <ChartCard title="⚡ Actividad reciente" accent="#22c55e">
          {data.liveFeed.length === 0 ? (
            <p style={emptyText}>Nada aún, ¡pronto! ✨</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {data.liveFeed.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 13,
                    padding: "6px 10px",
                    background: "#faf5ff",
                    borderRadius: 10,
                  }}
                >
                  <span style={{ color: "#444" }}>
                    <strong style={{ color: "#7a3fbf" }}>
                      {e.user_name || e.user_email || "anónimo"}
                    </strong>{" "}
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </span>
                  <span style={{ color: "#a06b8a", whiteSpace: "nowrap" }}>
                    {timeAgo(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function KpiRow({ k }: { k: MetricsResponse["kpis"] }) {
  const items = useMemo(
    () => [
      { label: "Usuarios totales", value: k.totalUsers, accent: "#ff477e", icon: "👥" },
      { label: "Activos hoy", value: k.activeToday, accent: "#22c55e", icon: "⚡" },
      { label: "Mensajes hoy", value: k.messagesToday, accent: "#a58eff", icon: "💬" },
      {
        label: "Premium",
        value: k.premiumUsers,
        accent: "#a17300",
        icon: "✨",
        suffix: k.premiumConversion > 0 ? `${k.premiumConversion}% conv.` : undefined,
      },
    ],
    [k],
  );
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}
    >
      {items.map((it) => (
        <Kpi key={it.label} {...it} />
      ))}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  icon,
  suffix,
}: {
  label: string;
  value: number;
  accent: string;
  icon: string;
  suffix?: string;
}) {
  const n = useCountUp(value);
  return (
    <div
      style={{
        ...card,
        padding: 18,
        background: `linear-gradient(135deg, white, ${accent}12)`,
        border: `1.5px solid ${accent}30`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ color: "#a06b8a", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ color: accent, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
        {n.toLocaleString()}
      </div>
      {suffix && (
        <div style={{ marginTop: 4, color: "#a06b8a", fontSize: 12 }}>{suffix}</div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...card, padding: 16, border: `1.5px solid ${accent}25` }}>
      <h3 style={{ margin: "0 0 12px", color: accent, fontSize: 15 }}>{title}</h3>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(12px)",
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 8px 30px rgba(255,133,162,0.15)",
};

const emptyText: React.CSSProperties = { color: "#a06b8a", margin: 0, fontSize: 13 };

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg,#a58eff,#7a3fbf)",
  color: "white",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 12,
  border: "1.5px solid #ff85a2",
  background: "white",
  color: "#c92a5a",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
