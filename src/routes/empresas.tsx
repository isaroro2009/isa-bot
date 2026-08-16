import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitB2BLead } from "@/lib/b2bLeads.functions";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "IsaBot para Empresas — IA con tu marca" },
      { name: "description", content: "Da a tu equipo una asistente IA con tu marca, tu logo y tu color. Multi-usuario, panel de administración y datos aislados." },
      { property: "og:title", content: "IsaBot para Empresas — IA con tu marca" },
      { property: "og:description", content: "IA multimodal white-label para tu empresa. Prueba 14 días gratis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "IsaBot para Empresas" },
      { name: "twitter:description", content: "IA white-label para equipos." },
    ],
  }),
  component: EmpresasPage,
});

const PLANS = [
  {
    name: "Trial",
    price: "Gratis",
    detail: "14 días · hasta 5 usuarios",
    features: ["IA multimodal completa", "Sin tarjeta requerida", "Migra a plan pago cuando quieras"],
    highlight: false,
  },
  {
    name: "Starter",
    price: "$19",
    detail: "USD / mes · hasta 10 asientos",
    features: ["Branding básico (logo + colores)", "Panel de admin", "Chats aislados por empresa"],
    highlight: true,
  },
  {
    name: "Business",
    price: "$49",
    detail: "USD / mes · hasta 30 asientos",
    features: ["Branding completo + nombre bot", "Soporte prioritario", "Analíticas del equipo"],
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Hablemos",
    detail: "Asientos ilimitados",
    features: ["SSO / SAML", "Contrato y facturación anual", "Onboarding dedicado"],
    highlight: false,
  },
];

function EmpresasPage() {
  const submit = useServerFn(submitB2BLead);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    employees_range: "1-10",
    use_case: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      await submit({ data: form });
      setStatus("ok");
      setForm({ company_name: "", contact_name: "", email: "", phone: "", employees_range: "1-10", use_case: "" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Error al enviar");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #ffd6eb 0%, #e0c3ff 50%, #c9b6ff 100%)",
      fontFamily: "'Quicksand', system-ui, sans-serif",
      color: "#3a2a4a",
    }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: 22, color: "#7c3aed", textDecoration: "none" }}>💕 IsaBot</Link>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link to="/" style={{ color: "#6b46c1", textDecoration: "none", fontWeight: 600 }}>App personal</Link>
          <a href="#pricing" style={{ color: "#6b46c1", textDecoration: "none", fontWeight: 600 }}>Precios</a>
          <a href="#contact" style={{ background: "#ec4899", color: "white", padding: "10px 18px", borderRadius: 999, textDecoration: "none", fontWeight: 700 }}>Agendar demo</a>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.6)", padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 20 }}>
          ✨ Nuevo · IsaBot White-Label
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 16, color: "#3a2a4a" }}>
          El co-piloto de IA creativa<br />
          <span style={{ background: "linear-gradient(90deg, #9b7ec9, #e8a5c7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            para tu equipo, con tu marca
          </span>
        </h1>
        <p style={{ fontSize: 18, maxWidth: 640, margin: "0 auto 32px", color: "#5b4270", lineHeight: 1.6 }}>
          IsaBot ayuda a tu equipo a estudiar mejor, emprender con foco y crear sin bloqueo — con tu logo, tus colores y tu nombre. Datos aislados, panel de admin y Modo Crack para validar ideas incluidos.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#contact" style={{ background: "#ec4899", color: "white", padding: "14px 28px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 16 }}>Empezar prueba gratis</a>
          <a href="#pricing" style={{ background: "rgba(255,255,255,0.7)", color: "#6b46c1", padding: "14px 28px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 16 }}>Ver planes</a>
        </div>
      </section>

      {/* BENEFITS */}
      <section style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {[
            { icon: "🎨", title: "Tu marca, no la nuestra", text: "Logo, colores y nombre de la bot personalizados por empresa." },
            { icon: "🔒", title: "Datos aislados", text: "Cada empresa tiene su workspace. Los chats no se mezclan." },
            { icon: "👥", title: "Panel de admin", text: "Invita a tu equipo por email. Gestiona roles y accesos." },
            { icon: "🧠", title: "IA multimodal", text: "Chat, análisis de imágenes, voz en tiempo real, generación de imágenes." },
          ].map((b) => (
            <div key={b.title} style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)", padding: 24, borderRadius: 20, boxShadow: "0 4px 16px rgba(236,72,153,0.1)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{b.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "#3a2a4a" }}>{b.title}</h3>
              <p style={{ fontSize: 14, color: "#5b4270", lineHeight: 1.5 }}>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: 1100, margin: "60px auto 40px", padding: "0 24px" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 8, color: "#3a2a4a" }}>Precios simples</h2>
        <p style={{ textAlign: "center", color: "#5b4270", marginBottom: 32 }}>Empieza gratis. Sin tarjeta requerida.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{
              background: p.highlight ? "linear-gradient(135deg, #ec4899, #7c3aed)" : "rgba(255,255,255,0.85)",
              color: p.highlight ? "white" : "#3a2a4a",
              padding: 24,
              borderRadius: 24,
              boxShadow: p.highlight ? "0 10px 30px rgba(236,72,153,0.4)" : "0 4px 16px rgba(0,0,0,0.05)",
              transform: p.highlight ? "scale(1.03)" : "none",
              position: "relative",
            }}>
              {p.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#fbbf24", color: "#3a2a4a", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                  MÁS POPULAR
                </div>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>{p.detail}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, lineHeight: 1.9 }}>
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT FORM */}
      <section id="contact" style={{ maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", padding: 32, borderRadius: 28, boxShadow: "0 10px 40px rgba(124,58,237,0.15)" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, color: "#3a2a4a", textAlign: "center" }}>Agenda una demo</h2>
          <p style={{ textAlign: "center", color: "#5b4270", marginBottom: 24, fontSize: 14 }}>Te contactamos en menos de 24h con acceso a tu workspace de prueba.</p>

          {status === "ok" ? (
            <div style={{ background: "#dcfce7", color: "#166534", padding: 20, borderRadius: 16, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💌</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>¡Recibimos tu solicitud!</div>
              <div style={{ fontSize: 13 }}>Isabella te escribirá muy pronto.</div>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <input required placeholder="Nombre de la empresa *" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} style={inputStyle} />
              <input required placeholder="Tu nombre *" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} />
              <input required type="email" placeholder="Email corporativo *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              <input placeholder="Teléfono (opcional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
              <select value={form.employees_range} onChange={(e) => setForm({ ...form, employees_range: e.target.value })} style={inputStyle}>
                <option value="1-10">1-10 empleados</option>
                <option value="11-50">11-50 empleados</option>
                <option value="51-200">51-200 empleados</option>
                <option value="200+">200+ empleados</option>
              </select>
              <textarea placeholder="Cuéntanos para qué la usarían (opcional)" value={form.use_case} onChange={(e) => setForm({ ...form, use_case: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              {status === "error" && <div style={{ color: "#b91c1c", fontSize: 13 }}>{errorMsg}</div>}
              <button type="submit" disabled={status === "sending"} style={{ background: "linear-gradient(90deg, #ec4899, #7c3aed)", color: "white", padding: "14px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: status === "sending" ? 0.6 : 1 }}>
                {status === "sending" ? "Enviando..." : "Solicitar demo →"}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "40px 24px", color: "#5b4270", fontSize: 13 }}>
        © {new Date().getFullYear()} IsaBot · Creado por Isabella Rodríguez Roque
      </footer>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e9d5ff",
  fontSize: 14,
  fontFamily: "inherit",
  background: "white",
  color: "#3a2a4a",
  outline: "none",
};
