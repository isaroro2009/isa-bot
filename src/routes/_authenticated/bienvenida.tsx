import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "../../isabot.css";

export const Route = createFileRoute("/_authenticated/bienvenida")({
  head: () => ({
    meta: [
      { title: "Bienvenida a IsaHaven" },
      { name: "description", content: "Tu espacio en IsaHaven está listo: estudia, emprende y crea con tu co-piloto de IA." },
      { property: "og:title", content: "Bienvenida a IsaHaven" },
      { property: "og:description", content: "Tu espacio en IsaHaven está listo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setName(p?.display_name || data.user.email?.split("@")[0] || "");
    });
  }, []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="auth-page">
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-emoji">🌸</div>
        <h1 className="auth-title">{greet}{name ? `, ${name}` : ""} ✨</h1>
        <p className="auth-sub">Qué alegría tenerte aquí. Tu espacio en IsaHaven está listo para estudiar, emprender y crear sin bloqueos.</p>
        <Link to="/" className="auth-submit-btn" style={{ display: "block", marginTop: 18, textDecoration: "none" }}>
          Entrar a IsaHaven 💬
        </Link>
      </div>
    </div>
  );
}
