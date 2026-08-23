import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { BRAINS } from "@/lib/brains";

import {
  listUsers,
  setUserRole,
  setUserPremium,
  deleteUser,
  getMyRoles,
  createUserManually,
  setUserCoins,
  setUnlimitedCoins,
  type AdminUserRow,
} from "@/lib/admin.functions";


import { getAiConfig } from "@/lib/memory.functions";
import { AdminMetrics } from "@/components/AdminMetrics";
import { BotWeeklyReport } from "@/components/BotWeeklyReport";
import { listB2BLeads, updateB2BLeadStatus, type B2BLead } from "@/lib/b2bLeads.functions";
import {
  listAllFeedback,
  updateFeedbackStatus,
  type AdminFeedbackItem,
} from "@/lib/feedback.functions";
import {
  listWeeklyGifts,
  createWeeklyGift,
  deleteWeeklyGift,
  moveWeeklyGift,
  publishNextGiftNow,
  getGiftAutomationStatus,
  type WeeklyGiftRow,
} from "@/lib/weeklyGifts.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel admin — IsaBot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const fetchUsers = useServerFn(listUsers);
  const fetchMyRoles = useServerFn(getMyRoles);
  const changeRole = useServerFn(setUserRole);
  const changePremium = useServerFn(setUserPremium);
  const removeUser = useServerFn(deleteUser);
  const fetchAiConfig = useServerFn(getAiConfig);
  const createUser = useServerFn(createUserManually);
  const saveCoins = useServerFn(setUserCoins);
  const saveUnlimited = useServerFn(setUnlimitedCoins);



  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [aiConfig, setAiConfig] = useState<{
    model: string;
    label: string;
    differentiator: string;
    modality: string;
  } | null>(null);
  

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchUsers();
      setUsers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { roles } = await fetchMyRoles();
        if (!roles.includes("admin")) {
          setError("No tienes permisos de administrador.");
          setLoading(false);
          return;
        }
        try {
          const cfg = await fetchAiConfig();
          setAiConfig(cfg);
        } catch { /* opcional */ }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = users.filter((u) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      u.email.toLowerCase().includes(s) ||
      (u.display_name ?? "").toLowerCase().includes(s) ||
      (u.phone ?? "").includes(s)
    );
  });

  const doChangeRole = async (u: AdminUserRow, isAdmin: boolean) => {
    setBusyId(u.id);
    try {
      await changeRole({ data: { userId: u.id, role: "admin", grant: isAdmin } });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const doTogglePremium = async (u: AdminUserRow) => {
    let days: number | null = null;
    if (!u.is_premium) {
      const choice = prompt(
        `¿Cuánto tiempo de Premium GRATIS para ${u.display_name ?? u.email}?\n\n` +
          `Escribe:\n` +
          `  • 7   → 7 días\n` +
          `  • 30  → 1 mes\n` +
          `  • 90  → 3 meses\n` +
          `  • 180 → 6 meses\n` +
          `  • 365 → 1 año\n` +
          `  • 0   → Permanente (para siempre 💕)\n`,
        "30",
      );
      if (choice === null) return;
      const n = parseInt(choice.trim(), 10);
      if (isNaN(n) || n < 0) {
        alert("Valor inválido");
        return;
      }
      days = n === 0 ? null : n;
    }
    setBusyId(u.id);
    try {
      await changePremium({ data: { userId: u.id, isPremium: !u.is_premium, days } });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  // 🪙 Gestor de IsaBot Coins
  const doEditCoins = async (u: AdminUserRow) => {
    const choice = prompt(
      `Nuevo saldo de IsaBot Coins para ${u.display_name ?? u.email}\n(actual: ${u.ibc_balance} IBC)`,
      String(u.ibc_balance),
    );
    if (choice === null) return;
    const n = parseInt(choice.trim(), 10);
    if (isNaN(n) || n < 0) {
      alert("Valor inválido");
      return;
    }
    setBusyId(u.id);
    try {
      await saveCoins({ data: { userId: u.id, balance: n } });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const doToggleUnlimited = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      await saveUnlimited({ data: { userId: u.id, unlimited: !u.unlimited_coins } });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };


  const doDelete = async (u: AdminUserRow) => {
    if (!confirm(`¿Eliminar la cuenta de ${u.email}? Esta acción no se puede deshacer.`)) return;
    setBusyId(u.id);
    try {
      await removeUser({ data: { userId: u.id } });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div
      style={{
        height: "100dvh",
        minHeight: "100vh",
        width: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(135deg, #ffd6eb 0%, #e0c3ff 50%, #c9b6ff 100%)",
        fontFamily: "'Quicksand', system-ui, sans-serif",
        padding: "24px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, color: "#ff477e", margin: 0, fontWeight: 800 }}>
              👑 Panel de administración
            </h1>
            <p style={{ color: "#a06b8a", margin: "4px 0 0", fontSize: 14 }}>
              Gestiona los usuarios de IsaBot
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to="/"
              style={{
                padding: "10px 16px",
                background: "white",
                borderRadius: 14,
                textDecoration: "none",
                color: "#ff477e",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(255,133,162,0.2)",
              }}
            >
              ← Al chat
            </Link>
            <button
              onClick={signOut}
              style={{
                padding: "10px 16px",
                background: "rgba(255,255,255,0.6)",
                border: "1.5px solid #ff85a2",
                borderRadius: 14,
                color: "#c92a5a",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {aiConfig && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,235,255,0.95))",
              backdropFilter: "blur(12px)",
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 10px 40px rgba(165,142,255,0.25)",
              border: "1.5px solid rgba(165,142,255,0.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", color: "#7a3fbf", fontSize: 18 }}>⚙️ Configuración de IA</h2>
                <p style={{ margin: 0, color: "#a06b8a", fontSize: 13 }}>
                  El motor que hace latir a IsaBot 💕
                </p>
              </div>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg,#a58eff,#7a3fbf)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 0.3,
                }}
              >
                ACTIVO
              </span>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <AiStat label="Modelo" value={aiConfig.model} accent="#7a3fbf" />
              <AiStat label="Descripción" value={aiConfig.label} accent="#ff477e" />
              <AiStat label="Modalidad" value={aiConfig.modality} accent="#a58eff" />
              <AiStat label="Diferenciador único" value={aiConfig.differentiator} accent="#ff85a2" />
            </div>
          </div>
        )}

        {!error && <BrainsSection />}

        {!error && (
          <div style={{ marginBottom: 16 }}>
            <AdminMetrics />
          </div>
        )}

        {!error && <BotWeeklyReport />}

        {/* Sección de correos desactivada por ahora (sin proveedor de envío). */}

        {!error && <FeedbackAdminSection />}

        {!error && <B2BLeadsSection />}

        {!error && <WeeklyGiftSection />}


        {(
        <div
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: 24,
            padding: 20,
            boxShadow: "0 10px 40px rgba(255,133,162,0.2)",
          }}
        >

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              placeholder="Buscar por correo, nombre o teléfono..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                flex: 1,
                minWidth: 220,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1.5px solid #ffd6eb",
                outline: "none",
                fontSize: 14,
                background: "white",
              }}
            />
            <button
              onClick={reload}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#ff85a2,#ff477e)",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🔄 Recargar
            </button>
          </div>

          {loading && <p style={{ color: "#a06b8a" }}>Cargando usuarios...</p>}
          {error && (
            <div style={{ background: "#ffe0ec", color: "#c92a5a", padding: 12, borderRadius: 12 }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#a06b8a", borderBottom: "2px solid #ffd6eb" }}>
                    <th style={th}>Usuario</th>
                    <th style={th}>Correo</th>
                    <th style={th}>Teléfono</th>
                    <th style={th}>Rol</th>
                    <th style={th}>Premium</th>
                    <th style={th}>Último acceso</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const isAdmin = u.roles.includes("admin");
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #fdeaf3" }}>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt=""
                                style={{ width: 32, height: 32, borderRadius: "50%" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg,#ffd6eb,#e0c3ff)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  color: "#ff477e",
                                }}
                              >
                                {(u.display_name ?? u.email)[0]?.toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontWeight: 600, color: "#333" }}>
                              {u.display_name ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>{u.phone ?? "—"}</td>
                        <td style={td}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: isAdmin ? "#ffe0ec" : "#f0e6ff",
                              color: isAdmin ? "#c92a5a" : "#6b46c1",
                            }}
                          >
                            {isAdmin ? "👑 admin" : "usuario"}
                          </span>
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: u.is_premium ? "#fff0c2" : "#f4f4f4",
                              color: u.is_premium ? "#a17300" : "#888",
                            }}
                          >
                            {u.is_premium ? "✨ premium" : "gratis"}
                          </span>
                        </td>
                        <td style={td}>
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString()
                            : "—"}
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              disabled={busy}
                              onClick={() => doChangeRole(u, !isAdmin)}
                              style={actionBtn(isAdmin ? "#c92a5a" : "#6b46c1")}
                            >
                              {isAdmin ? "Quitar admin" : "Hacer admin"}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => doTogglePremium(u)}
                              style={actionBtn("#a17300")}
                            >
                              {u.is_premium ? "Quitar premium" : "Dar premium"}
                            </button>
                            <button

                              disabled={busy}
                              onClick={() => doDelete(u)}
                              style={actionBtn("#c00")}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p style={{ textAlign: "center", color: "#a06b8a", padding: 20 }}>
                  No hay usuarios que coincidan.
                </p>
              )}
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 8px", color: "#444" };
const actionBtn = (color: string): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 10,
  border: `1.5px solid ${color}`,
  background: "white",
  color,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
});

function AiStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        padding: "10px 14px",
        border: `1.5px solid ${accent}30`,
      }}
    >
      <div style={{ fontSize: 11, color: "#a06b8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color: accent, fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

const FB_KIND_LABEL: Record<string, string> = {
  idea: "💡 Idea",
  problema: "🐞 Falla",
  amor: "💖 Amor",
  otro: "✨ Otro",
};

function FeedbackAdminSection() {
  const fetchAll = useServerFn(listAllFeedback);
  const setStatus = useServerFn(updateFeedbackStatus);
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try { setItems(await fetchAll()); } catch { /* noop */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const nuevos = items.filter((f) => f.status === "new").length;
  const avg = items.length
    ? (items.reduce((a, f) => a + f.rating, 0) / items.length).toFixed(1)
    : "—";

  async function change(id: string, status: string) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    try { await setStatus({ data: { id, status } }); } catch { load(); }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: "0 10px 40px rgba(255,133,162,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: "#7a3fbf", fontSize: 18 }}>💡 Feedback de usuarias</h2>
          <p style={{ margin: "4px 0 0", color: "#a06b8a", fontSize: 13 }}>
            {items.length} total · {nuevos} nuevos · promedio {avg}/5 · resumen semanal por correo
          </p>
        </div>
        <button onClick={() => setOpen(!open)} style={{ padding: "8px 14px", background: "white", border: "1.5px solid #e9d5ff", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#6b46c1" }}>
          {open ? "Ocultar" : "Ver feedback"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {items.length === 0 && (
            <p style={{ color: "#a06b8a", fontSize: 13 }}>Todavía no hay feedback 🌸</p>
          )}
          {items.map((f) => (
            <div key={f.id} className="admin-fb-item">
              <div className="admin-fb-top">
                <span>{FB_KIND_LABEL[f.kind] ?? f.kind}</span>
                <span>{"★".repeat(f.rating)}</span>
                <span>{f.author_name ?? f.author_email ?? "Anónima"}</span>
                <span>{new Date(f.created_at).toLocaleDateString("es")}</span>
                <select value={f.status} onChange={(e) => change(f.id, e.target.value)}>
                  <option value="new">🆕 Nuevo</option>
                  <option value="reviewed">👀 Revisado</option>
                  <option value="planned">🗓️ Planeado</option>
                  <option value="done">✅ Hecho</option>
                </select>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4b3a57", whiteSpace: "pre-wrap" }}>{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function B2BLeadsSection() {
  const fetchLeads = useServerFn(listB2BLeads);
  const setStatus = useServerFn(updateB2BLeadStatus);
  const [leads, setLeads] = useState<B2BLead[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setLeads(await fetchLeads()); } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const pending = leads.filter((l) => l.status === "new").length;

  return (
    <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: "0 10px 40px rgba(255,133,162,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: "#7a3fbf", fontSize: 18 }}>🏢 Leads B2B (Empresas)</h2>
          <p style={{ margin: "4px 0 0", color: "#a06b8a", fontSize: 13 }}>
            {leads.length} total · {pending} nuevos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/empresas" style={{ padding: "8px 14px", background: "linear-gradient(90deg,#ec4899,#7c3aed)", color: "white", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 12 }}>Ver landing</Link>
          <button onClick={() => setOpen(!open)} style={{ padding: "8px 14px", background: "white", border: "1.5px solid #e9d5ff", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#6b46c1" }}>
            {open ? "Ocultar" : "Ver leads"}
          </button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          {loading && <p style={{ color: "#a06b8a" }}>Cargando...</p>}
          {!loading && leads.length === 0 && <p style={{ color: "#a06b8a", fontSize: 13 }}>Aún no hay leads. Comparte /empresas para captar.</p>}
          {!loading && leads.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#a06b8a", borderBottom: "2px solid #ffd6eb" }}>
                  <th style={{ padding: 8 }}>Empresa</th>
                  <th style={{ padding: 8 }}>Contacto</th>
                  <th style={{ padding: 8 }}>Email</th>
                  <th style={{ padding: 8 }}>Tamaño</th>
                  <th style={{ padding: 8 }}>Uso</th>
                  <th style={{ padding: 8 }}>Estado</th>
                  <th style={{ padding: 8 }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #fdeaf3" }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{l.company_name}</td>
                    <td style={{ padding: 8 }}>{l.contact_name}{l.phone ? ` · ${l.phone}` : ""}</td>
                    <td style={{ padding: 8 }}><a href={`mailto:${l.email}`} style={{ color: "#7c3aed" }}>{l.email}</a></td>
                    <td style={{ padding: 8 }}>{l.employees_range ?? "—"}</td>
                    <td style={{ padding: 8, maxWidth: 260, whiteSpace: "normal" }}>{l.use_case ?? "—"}</td>
                    <td style={{ padding: 8 }}>
                      <select value={l.status} onChange={async (e) => { await setStatus({ data: { id: l.id, status: e.target.value } }); load(); }} style={{ padding: 4, borderRadius: 8, border: "1px solid #e9d5ff", fontSize: 12 }}>
                        <option value="new">Nuevo</option>
                        <option value="contacted">Contactado</option>
                        <option value="demo">Demo</option>
                        <option value="won">Cerrado</option>
                        <option value="lost">Perdido</option>
                      </select>
                    </td>
                    <td style={{ padding: 8, color: "#888", fontSize: 12 }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function getCurrentWeekKey() {
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const KIND_LABELS: Record<string, string> = {
  wallpaper: "📱 Wallpaper",
  sticker: "🌸 Sticker",
  outline: "✏️ Outline",
  planner: "🗓️ Planner",
  other: "💝 Otro",
};

function WeeklyGiftSection() {
  const fetchGifts = useServerFn(listWeeklyGifts);
  const createGift = useServerFn(createWeeklyGift);
  const removeGift = useServerFn(deleteWeeklyGift);
  const moveGift = useServerFn(moveWeeklyGift);
  const publishNow = useServerFn(publishNextGiftNow);
  const fetchStatus = useServerFn(getGiftAutomationStatus);

  const [gifts, setGifts] = useState<WeeklyGiftRow[]>([]);
  const [status, setStatus] = useState<{ queued: number; mailConfigured: boolean; weekKey: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState("wallpaper");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetEmail, setTargetEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([fetchGifts(), fetchStatus()]);
      setGifts(g);
      setStatus(s);
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const submit = async (queued: boolean) => {
    if (!title.trim()) { alert("Escribe un título 💕"); return; }
    setBusy(true);
    try {
      await createGift({ data: {
        kind,
        title: title.trim(),
        message: message.trim() || null,
        image_url: imageUrl.trim() || null,
        target_email: targetEmail.trim() || null,
        queued,
      }});
      setTitle(""); setMessage(""); setImageUrl(""); setTargetEmail("");
      await load();
      alert(queued ? "🎁 Regalo agregado a la cola" : "💌 ¡Regalo publicado!");
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const doDelete = async (id: string) => {
    if (!confirm("¿Eliminar este regalo?")) return;
    setBusy(true);
    try { await removeGift({ data: { id } }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const doMove = async (id: string, delta: number) => {
    setBusy(true);
    try { await moveGift({ data: { id, delta } }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const doPublishNow = async () => {
    if (!confirm("¿Publicar ahora el siguiente regalo de la cola?")) return;
    setBusy(true);
    try {
      const r = await publishNow();
      await load();
      alert(r.mailConfigured ? `💌 Publicado. Correos enviados: ${r.emailsSent}` : "🎁 Publicado (los correos aún no están configurados).");
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const queue = gifts.filter((g) => g.status !== "published");
  const published = gifts.filter((g) => g.status === "published");

  return (
    <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: "0 10px 40px rgba(255,133,162,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: "#7a3fbf", fontSize: 18 }}>🎁 Regalo Semanal (automático)</h2>
          <p style={{ margin: "4px 0 0", color: "#a06b8a", fontSize: 13 }}>
            Cada lunes 9:00 se publica solo el siguiente de la cola · semana actual {status?.weekKey ?? "…"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy || queue.length === 0} onClick={doPublishNow} style={{ padding: "8px 14px", background: "white", border: "1.5px solid #ffd6eb", color: "#c92a5a", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            ⚡ Publicar ahora
          </button>
          <button onClick={() => setOpen(!open)} style={{ padding: "8px 14px", background: "linear-gradient(90deg,#ff85a2,#ff477e)", color: "white", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {open ? "Ocultar" : "✨ Agregar a la cola"}
          </button>
        </div>
      </div>

      {queue.length === 0 && !loading && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#fff4d6", color: "#8a5b00", fontWeight: 700, fontSize: 13 }}>
          ⚠️ Cola vacía: agrega regalos para que el lunes se publique uno automáticamente.
        </div>
      )}
      {status && !status.mailConfigured && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#eef0ff", color: "#3f3f8a", fontSize: 13 }}>
          ✉️ Los avisos por correo están listos en el código, pero falta habilitar el envío de correos del proyecto.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={fieldLabel}>
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={fieldInput}>
                <option value="wallpaper">📱 Wallpaper</option>
                <option value="sticker">🌸 Sticker</option>
                <option value="outline">✏️ Outline</option>
                <option value="planner">🗓️ Planner</option>
                <option value="other">💝 Otro</option>
              </select>
            </label>
            <label style={fieldLabel}>
              Enviar a (correo · vacío = todas Premium)
              <input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} style={fieldInput} placeholder="correo@ejemplo.com" />
            </label>
          </div>
          <label style={fieldLabel}>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInput} placeholder="Wallpaper de otoño 🍂" />
          </label>
          <label style={fieldLabel}>
            Mensajito (opcional)
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...fieldInput, minHeight: 70, fontFamily: "inherit", resize: "vertical" }} placeholder="Un mensaje bonito para acompañar el regalo…" />
          </label>
          <label style={fieldLabel}>
            Imagen (URL o dataURL, opcional)
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={fieldInput} placeholder="https://…" />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => submit(true)} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ff85a2,#ff477e)", color: "white", fontWeight: 700, cursor: "pointer" }}>
              {busy ? "Guardando…" : "➕ Agregar a la cola"}
            </button>
            <button disabled={busy} onClick={() => submit(false)} style={{ padding: "10px 18px", borderRadius: 12, border: "1.5px solid #ffd6eb", background: "white", color: "#c92a5a", fontWeight: 700, cursor: "pointer" }}>
              💌 Publicar de una vez
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "8px 0", color: "#a06b8a", fontSize: 14 }}>🕒 Cola ({queue.length})</h3>
        {loading && <p style={{ color: "#a06b8a", fontSize: 13 }}>Cargando…</p>}
        {queue.map((g, i) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #fdeaf3", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: i === 0 ? "#c92a5a" : "#a06b8a", fontSize: 13 }}>{i === 0 ? "➡️ próximo" : `#${i + 1}`}</span>
            <span style={{ fontSize: 13 }}>{KIND_LABELS[g.kind] ?? g.kind}</span>
            <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{g.title}</span>
            <span style={{ fontSize: 12, color: "#888" }}>{g.target_email ?? "🌍 Todas Premium"}</span>
            <button disabled={busy} onClick={() => doMove(g.id, -1)} style={actionBtn("#7a3fbf")}>↑</button>
            <button disabled={busy} onClick={() => doMove(g.id, 1)} style={actionBtn("#7a3fbf")}>↓</button>
            <button disabled={busy} onClick={() => doDelete(g.id)} style={actionBtn("#c00")}>Eliminar</button>
          </div>
        ))}

        <h3 style={{ margin: "16px 0 8px", color: "#a06b8a", fontSize: 14 }}>✅ Publicados ({published.length})</h3>
        {published.length === 0 && <p style={{ color: "#a06b8a", fontSize: 13 }}>Aún no se ha publicado ningún regalo.</p>}
        {published.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#a06b8a", borderBottom: "2px solid #ffd6eb" }}>
                  <th style={{ padding: 8 }}>Semana</th>
                  <th style={{ padding: 8 }}>Tipo</th>
                  <th style={{ padding: 8 }}>Título</th>
                  <th style={{ padding: 8 }}>Para</th>
                  <th style={{ padding: 8 }}>Fecha</th>
                  <th style={{ padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {published.map((g) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid #fdeaf3" }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{g.week_key}</td>
                    <td style={{ padding: 8 }}>{KIND_LABELS[g.kind] ?? g.kind}</td>
                    <td style={{ padding: 8 }}>{g.title}</td>
                    <td style={{ padding: 8 }}>{g.target_email ?? "🌍 Todas Premium"}</td>
                    <td style={{ padding: 8, color: "#888", fontSize: 12 }}>{new Date(g.published_at ?? g.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: 8 }}>
                      <button disabled={busy} onClick={() => doDelete(g.id)} style={actionBtn("#c00")}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  color: "#a06b8a",
  fontWeight: 700,
};

const fieldInput: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1.5px solid #ffd6eb",
  outline: "none",
  fontSize: 14,
  background: "white",
  color: "#333",
};

// 🧠 Cerebros de IA: qué modelo real usa cada opción de IsaBot
const BRAIN_ROWS: Array<{
  emoji: string;
  name: string;
  id: string;
  engine: string;
  vendor: string;
  plan: string;
  use: string;
}> = [
  ...BRAINS.map((b) => ({
    emoji: b.emoji,
    name: b.name,
    id: b.id,
    engine: b.engine,
    vendor: b.vendor,
    plan: b.premium ? "Premium" : "Gratis",
    use: b.use,
  })),
  {
    emoji: "👁️",
    name: "IsaBot Visión",
    id: "auto (fotos)",
    engine: "qwen/qwen3.6-27b",
    vendor: "Qwen 3.6 27B (vía Groq)",
    plan: "Automático",
    use: "Se activa solo cuando se envía una imagen",
  },
  {
    emoji: "🎙️",
    name: "IsaBot Voz",
    id: "auto (audio)",
    engine: "whisper-large-v3-turbo",
    vendor: "OpenAI Whisper v3 Turbo (vía Groq)",
    plan: "Automático",
    use: "Transcribe notas de voz y llamadas",
  },
];


function BrainsSection() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        boxShadow: "0 8px 30px rgba(255,133,162,0.15)",
      }}
    >
      <h2 style={{ margin: "0 0 4px", color: "#7a3fbf", fontSize: 18 }}>
        🧠 Cerebros de IA — qué modelo es cada uno
      </h2>
      <p style={{ margin: "0 0 14px", color: "#a06b8a", fontSize: 13 }}>
        Los cerebros gratis y los Premium clásicos corren en el motor propio 24/7 (Groq Cloud);
        <b> IsaBot Genius</b> y <b>IsaBot Máximo</b> corren por el gateway de IA de Lovable. No se
        usan Claude (Anthropic), Kimi (Moonshot) ni Grok (xAI): requieren API key propia de cada
        proveedor.
      </p>

      <div style={{ overflowX: "auto" }} className="admin-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#c92a5a" }}>
              <th style={{ padding: 8 }}>Opción en la app</th>
              <th style={{ padding: 8 }}>ID interno</th>
              <th style={{ padding: 8 }}>Modelo real</th>
              <th style={{ padding: 8 }}>Proveedor / familia</th>
              <th style={{ padding: 8 }}>Plan</th>
              <th style={{ padding: 8 }}>Para qué sirve</th>
            </tr>
          </thead>
          <tbody>
            {BRAIN_ROWS.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid #ffe0ec" }}>
                <td style={{ padding: 8, fontWeight: 700, color: "#7a3fbf" }}>
                  {b.emoji} {b.name}
                </td>
                <td style={{ padding: 8, fontFamily: "monospace", color: "#a06b8a" }}>{b.id}</td>
                <td style={{ padding: 8, fontFamily: "monospace", color: "#333" }}>{b.engine}</td>
                <td style={{ padding: 8, color: "#555" }}>{b.vendor}</td>
                <td style={{ padding: 8 }}>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background:
                        b.plan === "Premium"
                          ? "#fff3cd"
                          : b.plan === "Gratis"
                            ? "#e8fbef"
                            : "#f2ebff",
                      color:
                        b.plan === "Premium"
                          ? "#a17300"
                          : b.plan === "Gratis"
                            ? "#15803d"
                            : "#7a3fbf",
                    }}
                  >
                    {b.plan}
                  </span>
                </td>
                <td style={{ padding: 8, color: "#555" }}>{b.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
