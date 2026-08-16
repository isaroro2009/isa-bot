import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgBySlug, updateOrgBranding } from "@/lib/organizations.functions";
import {
  listOrgMembers, listOrgInvites, createOrgInvite,
  updateOrgMemberRole, removeOrgMember, deleteOrgInvite,
} from "@/lib/orgMembers.functions";

export const Route = createFileRoute("/_authenticated/e/$slug/admin")({
  component: OrgAdmin,
});

function OrgAdmin() {
  const { slug } = useParams({ from: "/_authenticated/e/$slug/admin" });
  const qc = useQueryClient();
  const getOrg = useServerFn(getOrgBySlug);
  const listMembers = useServerFn(listOrgMembers);
  const listInvites = useServerFn(listOrgInvites);
  const invite = useServerFn(createOrgInvite);
  const changeRole = useServerFn(updateOrgMemberRole);
  const removeMember = useServerFn(removeOrgMember);
  const cancelInvite = useServerFn(deleteOrgInvite);
  const updateBranding = useServerFn(updateOrgBranding);

  const orgQ = useQuery({ queryKey: ["org", slug], queryFn: () => getOrg({ data: { slug } }) });
  const org = orgQ.data?.org;
  const role = orgQ.data?.role;
  const canAdmin = role === "org_owner" || role === "org_admin";
  const isOwner = role === "org_owner";

  const membersQ = useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => listMembers({ data: { org_id: org!.id } }),
    enabled: !!org,
  });
  const invitesQ = useQuery({
    queryKey: ["org-invites", org?.id],
    queryFn: () => listInvites({ data: { org_id: org!.id } }),
    enabled: !!org && canAdmin,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org_admin" | "org_member">("org_member");
  const [brand, setBrand] = useState<{ name?: string; bot_name?: string; primary_color?: string; secondary_color?: string; logo_url?: string | null }>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  if (!org) return <div style={{ padding: 40, textAlign: "center" }}>Cargando…</div>;
  if (!canAdmin) return <div style={{ padding: 40, textAlign: "center" }}>Solo el dueño o admins de la empresa pueden entrar aquí.</div>;

  const b = { ...org, ...brand };

  async function doInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await invite({ data: { org_id: org!.id, email: inviteEmail, role: inviteRole } });
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["org-invites", org!.id] });
      setMsg("Invitación creada ✨");
    } catch (err: any) { setMsg(err?.message ?? "Error"); }
  }

  async function saveBranding() {
    setSaving(true); setMsg("");
    try {
      await updateBranding({ data: { org_id: org!.id, ...brand } });
      qc.invalidateQueries({ queryKey: ["org", slug] });
      setBrand({});
      setMsg("Guardado ✨");
    } catch (err: any) { setMsg(err?.message ?? "Error"); }
    finally { setSaving(false); }
  }

  const inviteLink = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/e/${slug}/join?token=${token}`;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 80px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Administrar {org.name}</h1>
      <p style={{ color: "#5b4270", fontSize: 13, marginBottom: 20 }}>Rol: {role} · Plan: {org.plan}</p>

      {msg && <div style={{ padding: 10, background: "rgba(255,255,255,0.85)", borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{msg}</div>}

      {/* BRANDING */}
      <section style={card}>
        <h2 style={h2}>🎨 Marca</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Nombre empresa</label>
            <input value={b.name ?? ""} onChange={(e) => setBrand({ ...brand, name: e.target.value })} style={inp} />
          </div>
          <div>
            <label style={lbl}>Nombre de la bot</label>
            <input value={b.bot_name ?? ""} onChange={(e) => setBrand({ ...brand, bot_name: e.target.value })} style={inp} />
          </div>
          <div>
            <label style={lbl}>Color primario</label>
            <input type="color" value={b.primary_color ?? "#ec4899"} onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })} style={{ ...inp, height: 44, padding: 4 }} />
          </div>
          <div>
            <label style={lbl}>Color secundario</label>
            <input type="color" value={b.secondary_color ?? "#7c3aed"} onChange={(e) => setBrand({ ...brand, secondary_color: e.target.value })} style={{ ...inp, height: 44, padding: 4 }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>URL del logo (https://...)</label>
            <input value={b.logo_url ?? ""} onChange={(e) => setBrand({ ...brand, logo_url: e.target.value || null })} style={inp} placeholder="https://ejemplo.com/logo.png" />
          </div>
        </div>
        <button onClick={saveBranding} disabled={saving || Object.keys(brand).length === 0} style={btnPrimary}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </section>

      {/* INVITE */}
      <section style={card}>
        <h2 style={h2}>➕ Invitar miembro</h2>
        <form onSubmit={doInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="persona@empresa.com" style={{ ...inp, flex: 1, minWidth: 200 }} />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} style={inp}>
            <option value="org_member">Miembro</option>
            <option value="org_admin">Admin</option>
          </select>
          <button type="submit" style={btnPrimary}>Invitar</button>
        </form>

        {(invitesQ.data ?? []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5b4270", marginBottom: 8 }}>Invitaciones pendientes</div>
            {invitesQ.data!.map((inv) => (
              <div key={inv.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "#5b4270", wordBreak: "break-all" }}>{inviteLink(inv.token)}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink(inv.token)); setMsg("Link copiado 📋"); }} style={btnSmall}>Copiar</button>
                <button onClick={async () => { await cancelInvite({ data: { invite_id: inv.id } }); qc.invalidateQueries({ queryKey: ["org-invites", org.id] }); }} style={{ ...btnSmall, background: "#fee2e2", color: "#b91c1c" }}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MEMBERS */}
      <section style={card}>
        <h2 style={h2}>👥 Miembros ({membersQ.data?.length ?? 0}/{org.seats_limit})</h2>
        {(membersQ.data ?? []).map((m) => (
          <div key={m.id} style={row}>
            {m.avatar_url ? (
              <img src={m.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${org.primary_color}, ${org.secondary_color})`, color: "white", display: "grid", placeItems: "center", fontWeight: 700 }}>
                {(m.display_name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.display_name ?? m.email}</div>
              <div style={{ fontSize: 12, color: "#5b4270" }}>{m.email}</div>
            </div>
            {isOwner && m.role !== "org_owner" ? (
              <select value={m.role} onChange={async (e) => { await changeRole({ data: { org_id: org.id, user_id: m.user_id, role: e.target.value as any } }); qc.invalidateQueries({ queryKey: ["org-members", org.id] }); }} style={{ ...inp, padding: "6px 8px" }}>
                <option value="org_member">Miembro</option>
                <option value="org_admin">Admin</option>
                <option value="org_owner">Dueño</option>
              </select>
            ) : (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: m.role === "org_owner" ? "#fbbf24" : "rgba(124,58,237,0.15)", color: m.role === "org_owner" ? "#78350f" : "#6b46c1", fontWeight: 700 }}>
                {m.role === "org_owner" ? "Dueño" : m.role === "org_admin" ? "Admin" : "Miembro"}
              </span>
            )}
            {isOwner && m.role !== "org_owner" && (
              <button onClick={async () => { if (confirm(`¿Remover a ${m.email}?`)) { await removeMember({ data: { org_id: org.id, user_id: m.user_id } }); qc.invalidateQueries({ queryKey: ["org-members", org.id] }); } }} style={{ ...btnSmall, background: "#fee2e2", color: "#b91c1c" }}>Quitar</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

const card: React.CSSProperties = { background: "rgba(255,255,255,0.85)", padding: 24, borderRadius: 24, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" };
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 12 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#5b4270", marginBottom: 4 };
const inp: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #e9d5ff", fontSize: 14, background: "white", color: "#3a2a4a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const btnPrimary: React.CSSProperties = { background: "linear-gradient(90deg, #ec4899, #7c3aed)", color: "white", padding: "10px 18px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnSmall: React.CSSProperties = { background: "rgba(255,255,255,0.9)", padding: "6px 12px", borderRadius: 999, border: "1px solid #e9d5ff", fontSize: 12, cursor: "pointer", fontWeight: 600 };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.05)" };
