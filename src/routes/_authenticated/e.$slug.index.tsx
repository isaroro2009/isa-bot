import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgBySlug } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/e/$slug/")({
  component: OrgHome,
});

function OrgHome() {
  const { slug } = useParams({ from: "/_authenticated/e/$slug/" });
  const get = useServerFn(getOrgBySlug);
  const { data } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => get({ data: { slug } }),
  });
  if (!data) return null;
  const { org, role } = data;
  const canAdmin = role === "org_owner" || role === "org_admin";
  const trialEnds = new Date(org.trial_ends_at);
  const daysLeft = Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400_000));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 28, padding: 32, boxShadow: "0 10px 40px rgba(124,58,237,0.1)", textAlign: "center" }}>
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} style={{ width: 80, height: 80, borderRadius: 20, objectFit: "cover", margin: "0 auto 12px" }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${org.primary_color}, ${org.secondary_color})`, display: "grid", placeItems: "center", color: "white", fontWeight: 800, fontSize: 32, margin: "0 auto 12px" }}>
            {org.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Bienvenido a {org.name}</h1>
        <p style={{ color: "#5b4270", fontSize: 15 }}>
          Tu asistente <strong>{org.bot_name}</strong> está lista · Plan <strong>{org.plan}</strong>
          {org.plan === "trial" && ` · ${daysLeft} días restantes`}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
          <Link to="/" style={btn(org.primary_color, org.secondary_color)}>💬 Chatear con {org.bot_name}</Link>
          {canAdmin && <Link to="/e/$slug/admin" params={{ slug }} style={btnGhost}>⚙️ Administrar equipo</Link>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
        {[
          { icon: "🧠", title: "IA multimodal", text: `Chat, imágenes, voz y análisis con ${org.bot_name}.` },
          { icon: "👥", title: "Tu equipo", text: canAdmin ? "Invita a más miembros desde Administrar." : "Contacta al admin para invitaciones." },
          { icon: "🎨", title: "Tu marca", text: canAdmin ? "Cambia logo y colores cuando quieras." : "Tu empresa tiene branding personalizado." },
        ].map((c) => (
          <div key={c.title} style={{ background: "rgba(255,255,255,0.75)", padding: 20, borderRadius: 20 }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 13, color: "#5b4270" }}>{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = (a: string, b: string): React.CSSProperties => ({
  background: `linear-gradient(90deg, ${a}, ${b})`,
  color: "white", padding: "14px 24px", borderRadius: 999,
  textDecoration: "none", fontWeight: 700, fontSize: 15,
  boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
});
const btnGhost: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)", color: "#3a2a4a",
  padding: "14px 24px", borderRadius: 999, textDecoration: "none",
  fontWeight: 700, fontSize: 15,
};
