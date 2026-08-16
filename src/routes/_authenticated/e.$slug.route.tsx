import { createFileRoute, Outlet, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgBySlug, type Organization } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/e/$slug")({
  component: OrgLayout,
});

export type OrgContext = { org: Organization; role: string };

function OrgLayout() {
  const { slug } = useParams({ from: "/_authenticated/e/$slug" });
  const get = useServerFn(getOrgBySlug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => get({ data: { slug } }),
  });

  if (isLoading) {
    return <FullScreen>Cargando organización…</FullScreen>;
  }
  if (error || !data) {
    return (
      <FullScreen>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚫</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No puedes ver esta organización</div>
          <div style={{ fontSize: 13, color: "#5b4270", marginBottom: 16 }}>
            {(error as any)?.message ?? "Organización no encontrada"}
          </div>
          <Link to="/" style={backLink}>← Ir a mi IsaBot</Link>
        </div>
      </FullScreen>
    );
  }

  const { org, role } = data;
  const canAdmin = role === "org_owner" || role === "org_admin";

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${org.primary_color}33 0%, ${org.secondary_color}44 100%)`,
      fontFamily: "'Quicksand', system-ui, sans-serif",
      color: "#3a2a4a",
      // expose CSS vars for downstream children if needed
      ["--org-primary" as any]: org.primary_color,
      ["--org-secondary" as any]: org.secondary_color,
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)",
        borderBottom: `2px solid ${org.primary_color}55`,
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <Link to="/e/$slug" params={{ slug }} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#3a2a4a" }}>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${org.primary_color}, ${org.secondary_color})`, display: "grid", placeItems: "center", color: "white", fontWeight: 800 }}>
              {org.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{org.name}</div>
            <div style={{ fontSize: 11, color: "#5b4270" }}>{org.bot_name} · {org.plan}</div>
          </div>
        </Link>
        <nav style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
          <Link to="/e/$slug" params={{ slug }} style={navLink}>Inicio</Link>
          {canAdmin && (
            <Link to="/e/$slug/admin" params={{ slug }} style={navLink}>Administrar</Link>
          )}
          <Link to="/" style={{ ...navLink, background: `linear-gradient(90deg, ${org.primary_color}, ${org.secondary_color})`, color: "white" }}>
            Mi IsaBot personal
          </Link>
        </nav>
      </header>

      <Outlet />
    </div>
  );
}

const navLink: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "#3a2a4a",
  background: "rgba(255,255,255,0.6)",
};

const backLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 20px",
  background: "#ec4899",
  color: "white",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 700,
};

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid", placeItems: "center",
      background: "linear-gradient(135deg, #ffd6eb 0%, #e0c3ff 50%, #c9b6ff 100%)",
      fontFamily: "'Quicksand', system-ui, sans-serif",
      padding: 24, color: "#3a2a4a",
    }}>
      {children}
    </div>
  );
}
