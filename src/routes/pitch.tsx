import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: "IsaBot — Pitch: IA creativa gamificada para LATAM" },
      {
        name: "description",
        content:
          "IsaBot: co-piloto de IA creativa con economía gamificada (IsaBot Coins), agentes autónomos, academia y red social de creadores. Métricas, arquitectura y demo en vivo.",
      },
      { property: "og:title", content: "IsaBot — Pitch para ecosistemas tech" },
      {
        property: "og:description",
        content: "Economía IBC, agentes de IA, IsaStudio, IsaSpace e IsaAcademy en una sola plataforma. Demo en vivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PitchPage,
});

const METRICS = [
  { k: "Agentes de IA", v: "6+", d: "Chat, PDF, email, ventas, planner y noticias" },
  { k: "Módulos vivos", v: "4", d: "IsaStudio, IsaSpace, IsaAcademy, IsaAgent" },
  { k: "Economía", v: "IBC", d: "Moneda gamificada con rachas y tienda" },
  { k: "Disponibilidad", v: "24/7", d: "PWA instalable + modo sin conexión" },
];

const PILLARS = [
  {
    e: "🪙",
    t: "IsaBot Coins (IBC)",
    d: "Economía gamificada estilo Duolingo: rachas diarias, recompensas por crear y publicar, tienda de skins y suscripción PRO. Monetización híbrida: freemium + micro-compras.",
  },
  {
    e: "🤖",
    t: "Agentes autónomos",
    d: "Agentes que redactan, generan PDFs, envían correos, planifican el día y hacen prospección. Enrutamiento multi-modelo (Groq, Gemini, modelos locales en el dispositivo).",
  },
  {
    e: "🎨",
    t: "IsaStudio",
    d: "Suite creativa tipo Canva: plantillas, lienzo editable, pixel art, documentos, slides y hojas de cálculo con exportación instantánea a PDF/PNG/CSV.",
  },
  {
    e: "🪐",
    t: "IsaSpace + IsaAcademy",
    d: "Red social de \"proof of creation\" para creadores y una academia de IA, 3D y desarrollo con retos que devuelven IBC. Retención por comunidad y aprendizaje.",
  },
];

const STACK = [
  "TanStack Start + React 19",
  "Backend serverless en el edge",
  "Postgres con RLS estricta",
  "Multi-modelo: Groq · Gemini · WebLLM local",
  "PWA instalable (Android / iOS)",
  "API de WhatsApp Business / Evolution",
];

function PitchPage() {
  return (
    <main className="pitch">
      <style>{`
        .pitch{min-height:100vh;background:radial-gradient(1200px 600px at 20% -10%,#f0e2ff,transparent),linear-gradient(180deg,#fbf7ff,#f4ecff);color:#3d2450;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:0 0 64px;}
        .pitch-wrap{max-width:1080px;margin:0 auto;padding:0 18px;}
        .pitch-hero{padding:64px 0 40px;text-align:center;}
        .pitch-badge{display:inline-block;padding:7px 14px;border-radius:999px;background:rgba(201,167,255,.35);font-size:13px;font-weight:700;color:#5b3a95;}
        .pitch h1{font-size:clamp(32px,6vw,58px);line-height:1.05;margin:16px 0 12px;color:#4a2b8a;}
        .pitch-sub{font-size:clamp(15px,2.4vw,20px);max-width:720px;margin:0 auto;color:#6b5b86;line-height:1.6;}
        .pitch-ctas{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:26px;}
        .pitch-btn{border:none;cursor:pointer;border-radius:999px;padding:14px 22px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;background:linear-gradient(90deg,#c9a7ff,#ff9ed6);color:#3d2450;box-shadow:0 14px 30px -18px rgba(107,63,160,.8);}
        .pitch-btn.ghost{background:rgba(255,255,255,.8);color:#5b3a95;border:1px solid rgba(155,110,255,.35);box-shadow:none;}
        .pitch-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:40px 0;}
        .pitch-metric{background:rgba(255,255,255,.85);border:1px solid rgba(155,110,255,.22);border-radius:20px;padding:20px;text-align:center;}
        .pitch-metric b{display:block;font-size:32px;color:#6b3fa0;}
        .pitch-metric span{font-weight:700;font-size:14px;}
        .pitch-metric small{display:block;margin-top:6px;font-size:12px;color:#6b5b86;line-height:1.45;}
        .pitch-section{margin:52px 0;}
        .pitch-section h2{font-size:clamp(22px,3.6vw,32px);color:#4a2b8a;margin-bottom:8px;}
        .pitch-section p.lead{color:#6b5b86;max-width:720px;line-height:1.6;}
        .pitch-cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:22px;}
        .pitch-card{background:linear-gradient(160deg,#ffffff,#f7efff);border:1px solid rgba(155,110,255,.22);border-radius:22px;padding:22px;transition:transform .22s ease,box-shadow .22s ease;}
        .pitch-card:hover{transform:translateY(-4px);box-shadow:0 18px 38px -20px rgba(107,63,160,.6);}
        .pitch-card em{font-style:normal;font-size:30px;}
        .pitch-card h3{margin:10px 0 6px;font-size:18px;color:#4a2b8a;}
        .pitch-card p{font-size:14px;line-height:1.55;color:#6b5b86;margin:0;}
        .pitch-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;}
        .pitch-chip{background:rgba(255,255,255,.8);border:1px solid rgba(155,110,255,.28);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;color:#5b3a95;}
        .pitch-flow{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:20px;}
        .pitch-step{background:rgba(255,255,255,.8);border:1px dashed rgba(155,110,255,.4);border-radius:16px;padding:16px;font-size:13px;color:#5b3a95;text-align:center;font-weight:600;}
        .pitch-foot{text-align:center;margin-top:56px;color:#6b5b86;font-size:14px;}
      `}</style>

      <div className="pitch-wrap">
        <header className="pitch-hero">
          <span className="pitch-badge">IsaRoRo Studio · Pitch deck en vivo</span>
          <h1>IsaBot: el co-piloto de IA creativa que se juega, no solo se usa</h1>
          <p className="pitch-sub">
            Una plataforma que une agentes de IA, una suite creativa tipo Canva, una academia y una red social de
            creadores — todo movido por una economía gamificada propia: los IsaBot Coins (IBC).
          </p>
          <div className="pitch-ctas">
            <Link to="/" className="pitch-btn">🚀 Probar la demo en vivo</Link>
            <Link to="/empresas" className="pitch-btn ghost">🏢 IsaBot para empresas</Link>
          </div>
        </header>

        <section className="pitch-grid" aria-label="Métricas clave">
          {METRICS.map((m) => (
            <div key={m.k} className="pitch-metric">
              <b>{m.v}</b>
              <span>{m.k}</span>
              <small>{m.d}</small>
            </div>
          ))}
        </section>

        <section className="pitch-section">
          <h2>Arquitectura del producto</h2>
          <p className="lead">
            Cuatro pilares conectados por la misma moneda y el mismo motor de IA, con retención diseñada desde el
            primer día.
          </p>
          <div className="pitch-cards">
            {PILLARS.map((p) => (
              <article key={p.t} className="pitch-card">
                <em>{p.e}</em>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pitch-section">
          <h2>Cómo circula el valor (IBC)</h2>
          <div className="pitch-flow">
            <div className="pitch-step">1 · Entra y mantiene su racha diaria</div>
            <div className="pitch-step">2 · Gana IBC creando y publicando</div>
            <div className="pitch-step">3 · Gasta IBC en agentes y skins</div>
            <div className="pitch-step">4 · Sube a PRO o compra IBC extra</div>
          </div>
        </section>

        <section className="pitch-section">
          <h2>Stack e integraciones</h2>
          <p className="lead">Infraestructura serverless en el edge, multi-modelo y lista para escalar sin bloqueos de proveedor.</p>
          <div className="pitch-chips">
            {STACK.map((s) => (
              <span key={s} className="pitch-chip">{s}</span>
            ))}
          </div>
        </section>

        <section className="pitch-section">
          <h2>Demos que puedes abrir ahora</h2>
          <div className="pitch-ctas" style={{ justifyContent: "flex-start" }}>
            <Link to="/" className="pitch-btn ghost">💬 Chat con agentes</Link>
            <Link to="/studio" className="pitch-btn ghost">🎨 IsaStudio</Link>
            <Link to="/isaspace" className="pitch-btn ghost">🪐 IsaSpace</Link>
          </div>
        </section>

        <p className="pitch-foot">
          IsaBot — creado por Isabella Rodríguez Roque · IsaRoRo Studio. Instalable como app en Android e iOS y
          disponible también por WhatsApp.
        </p>
      </div>
    </main>
  );
}
