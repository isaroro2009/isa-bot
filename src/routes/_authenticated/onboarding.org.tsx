import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOrganization, checkSlugAvailable } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/onboarding/org")({
  component: OnboardingOrg,
});

function OnboardingOrg() {
  const nav = useNavigate();
  const create = useServerFn(createOrganization);
  const check = useServerFn(checkSlugAvailable);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    bot_name: "IsaBot",
    primary_color: "#ec4899",
    secondary_color: "#7c3aed",
  });
  const [slugStatus, setSlugStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function verifySlug(v: string) {
    const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
    setForm({ ...form, slug: clean });
    if (clean.length < 3) { setSlugStatus(null); return; }
    try {
      const r = await check({ data: { slug: clean } });
      setSlugStatus({ ok: r.available, msg: r.available ? "Disponible ✨" : (r.reason ?? "No disponible") });
    } catch { setSlugStatus(null); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const org = await create({ data: form });
      nav({ to: "/e/$slug", params: { slug: org.slug } });
    } catch (err: any) {
      setError(err?.message ?? "Error al crear la organización");
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #ffd6eb 0%, #e0c3ff 50%, #c9b6ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Quicksand', system-ui, sans-serif",
    }}>
      <div style={{ background: "rgba(255,255,255,0.9)", padding: 32, borderRadius: 28, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(124,58,237,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢✨</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#3a2a4a" }}>Crea tu empresa en IsaBot</h1>
          <p style={{ color: "#5b4270", fontSize: 14, marginTop: 4 }}>Trial de 14 días · sin tarjeta</p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={label}>Nombre de la empresa</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc." style={inp} />
          </div>
          <div>
            <label style={label}>URL de tu workspace</label>
            <div style={{ display: "flex", alignItems: "center", background: "white", borderRadius: 12, border: "1px solid #e9d5ff", overflow: "hidden" }}>
              <span style={{ padding: "12px 4px 12px 14px", color: "#8b7ba8", fontSize: 13 }}>isabot.app/e/</span>
              <input required value={form.slug} onChange={(e) => verifySlug(e.target.value)} placeholder="acme" style={{ ...inp, border: "none", padding: "12px 14px 12px 0", flex: 1 }} />
            </div>
            {slugStatus && <div style={{ fontSize: 12, marginTop: 4, color: slugStatus.ok ? "#059669" : "#b91c1c" }}>{slugStatus.msg}</div>}
          </div>
          <div>
            <label style={label}>Nombre de la bot</label>
            <input value={form.bot_name} onChange={(e) => setForm({ ...form, bot_name: e.target.value })} placeholder="AcmeBot" style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Color primario</label>
              <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} style={{ ...inp, height: 44, padding: 4 }} />
            </div>
            <div>
              <label style={label}>Color secundario</label>
              <input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} style={{ ...inp, height: 44, padding: 4 }} />
            </div>
          </div>

          {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting || (slugStatus !== null && !slugStatus.ok)} style={{
            background: "linear-gradient(90deg, #ec4899, #7c3aed)",
            color: "white", padding: "14px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 15,
            cursor: "pointer", marginTop: 8,
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? "Creando..." : "Crear empresa ✨"}
          </button>

          <Link to="/" style={{ textAlign: "center", color: "#7c3aed", fontSize: 13, textDecoration: "none", marginTop: 4 }}>
            ← Volver al inicio
          </Link>
        </form>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#5b4270", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e9d5ff", fontSize: 14, background: "white", color: "#3a2a4a", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
