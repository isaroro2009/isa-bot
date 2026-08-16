import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import "../isabot.css";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "IsaBot — Co-piloto de IA Creativa para Estudiantes y Emprendedores" },
      { name: "description", content: "IsaBot es tu co-piloto de IA creativa: estudia mejor, emprende con foco y crea sin bloqueo. Un espacio hecho en IsaRoRo Studio." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              display_name: displayName || email.split("@")[0],
              phone,
            },
          },
        });
        if (err) throw err;
        setInfo("¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión 💕");
        setMode("signin");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar con Google");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-emoji">✨</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#9b7ec9", textTransform: "uppercase", marginBottom: 6 }}>
            IsaRoRo Studio
          </div>
          <h1 className="auth-title">
            {mode === "signin" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h1>
          <p className="auth-sub">
            {mode === "signin"
              ? "Tu co-piloto de IA creativa para estudiar mejor, emprender con foco y crear sin bloqueo."
              : "Únete a IsaBot — el co-piloto de IA para estudiantes y emprendedores."}
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
            {["📚 Estudia mejor", "🚀 Emprende con foco", "🎨 Crea sin bloqueo"].map((chip) => (
              <span key={chip} style={{
                fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                background: "rgba(201, 182, 255, 0.22)", color: "#5b4270",
              }}>{chip}</span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="auth-google-btn"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.3-8L6.2 33C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div className="auth-divider">
          <span>o con tu correo</span>
        </div>

        <form onSubmit={handleEmailAuth} className="auth-form">
          {mode === "signup" && (
            <>
              <input
                type="text"
                placeholder="Nombre para mostrar"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="auth-input"
              />
              <input
                type="tel"
                placeholder="Celular (opcional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="auth-input"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Correo"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Contraseña"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {info && <div className="auth-alert auth-alert-info">{info}</div>}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? "..." : mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="auth-switch-btn"
          >
            {mode === "signin" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>

        <p className="auth-back">
          <Link to="/">← Volver al chat</Link>
        </p>
      </div>
    </div>
  );
}
