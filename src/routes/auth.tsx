import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import LandingModal from "@/components/LandingModal";
import { ensureGuestVip } from "@/lib/guest.functions";
import { registerWithKey, loginWithKey } from "@/lib/passwordless.functions";
import { getStoredKey, storeKey, clearStoredKey } from "@/lib/access-key";
import "../isabot.css";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "IsaHaven — Entra con tu llave personal" },
      { name: "description", content: "Crea tu cuenta de IsaHaven con tu nombre y correo y entra siempre con tu llave personal, sin contraseñas." },
      { property: "og:title", content: "IsaHaven — Entra con tu llave personal" },
      { property: "og:description", content: "Tu co-piloto de IA creativa. Sin contraseñas: una llave personal ISA-XXXX te da acceso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signup" | "key";

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const goWelcome = () => navigate({ to: "/bienvenida" });

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("isabot_intro_seen")) setShowIntro(false);
    } catch {
      /* noop */
    }
    (async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (data.user) {
        navigate({ to: "/" });
        return;
      }
      const stored = getStoredKey();
      if (!stored) return;
      setAutoLogin(true);
      try {
        const creds = await loginWithKey({ data: { key: stored } });
        const { error: err } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (err) throw err;
        goWelcome();
      } catch {
        clearStoredKey();
        setAutoLogin(false);
        setShowIntro(false);
        setMode("key");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAuth = () => {
    try {
      window.sessionStorage.setItem("isabot_intro_seen", "1");
    } catch {
      /* noop */
    }
    setShowIntro(false);
  };

  const fail = (err: unknown) => {
    const msg = err instanceof Error ? err.message : t("auth.genericError");
    setError(msg);
    toast.error(msg, { duration: 7000 });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const creds = await registerWithKey({ data: { email: email.trim(), name: displayName.trim() } });
      const { error: err } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (err) throw err;
      storeKey(creds.accessKey);
      setNewKey(creds.accessKey);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const creds = await loginWithKey({ data: { key: keyInput } });
      const { error: err } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (err) throw err;
      storeKey(creds.key);
      goWelcome();
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestVip = async () => {
    setError(null);
    setLoading(true);
    try {
      const creds = await ensureGuestVip();
      const { error: err } = await supabase.auth.signInWithPassword(creds);
      if (err) throw err;
      goWelcome();
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  if (autoLogin) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-emoji">🔑</div>
          <p className="auth-sub">Abriendo tu espacio con tu llave personal…</p>
        </div>
      </div>
    );
  }

  if (showIntro && !newKey) return <LandingModal onStart={startAuth} />;

  if (newKey) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-emoji">🔑</div>
          <h1 className="auth-title">Esta es tu llave personal</h1>
          <div
            style={{
              fontFamily: "monospace", fontSize: 26, fontWeight: 800, letterSpacing: 2,
              padding: "14px 10px", margin: "14px 0", borderRadius: 14,
              background: "rgba(201, 182, 255, 0.22)", color: "#4a2f5c",
            }}
          >
            {newKey}
          </div>
          <p className="auth-sub">
            Ya quedó guardada en este dispositivo: no tendrás que escribir nada en tus próximas visitas.
            Guárdala para entrar desde otro celular o computador.
          </p>
          <button
            type="button"
            className="auth-submit-btn"
            style={{ marginTop: 10 }}
            onClick={() => {
              navigator.clipboard?.writeText(newKey).then(() => toast.success("Llave copiada 📋"));
            }}
          >
            📋 Copiar llave
          </button>
          <button type="button" className="auth-submit-btn" style={{ marginTop: 10 }} onClick={goWelcome}>
            Continuar ✨
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />

      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <LanguageToggle />
        </div>
        <div className="auth-header">
          <div className="auth-emoji">{mode === "signup" ? "✨" : "🔑"}</div>
          <h1 className="auth-title">{mode === "signup" ? "Crea tu cuenta" : "Entra con tu llave"}</h1>
          <p className="auth-sub">
            {mode === "signup"
              ? "Solo tu nombre y tu correo. Te daremos una llave personal, sin contraseñas."
              : "Escribe tu llave personal (ISA-XXXX-XXXX) una sola vez en este dispositivo."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["signup", "key"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className="auth-submit-btn"
              style={{ flex: 1, opacity: mode === m ? 1 : 0.55, padding: "8px 10px" }}
            >
              {m === "signup" ? "Crear cuenta" : "Tengo mi llave"}
            </button>
          ))}
        </div>

        {mode === "signup" ? (
          <form onSubmit={handleSignup} className="auth-form">
            <input type="text" placeholder={t("auth.displayName")} required value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} className="auth-input" autoComplete="name" />
            <input type="email" placeholder={t("auth.email")} required value={email}
              onChange={(e) => setEmail(e.target.value)} className="auth-input" autoComplete="email" />
            {error && <div className="auth-alert auth-alert-error">{error}</div>}
            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? "..." : "Crear mi cuenta y mi llave ✨"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleKey} className="auth-form">
            <input type="text" placeholder="ISA-XXXX-XXXX" required value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())} className="auth-input"
              autoComplete="off" style={{ fontFamily: "monospace", letterSpacing: 2, textAlign: "center" }} />
            {error && <div className="auth-alert auth-alert-error">{error}</div>}
            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? "..." : "Entrar 🔑"}
            </button>
          </form>
        )}

        <button type="button" onClick={handleGuestVip} disabled={loading} className="auth-submit-btn"
          style={{ marginTop: 10, background: "linear-gradient(135deg, #ffd980, #ffb3d1)", color: "#4a2f5c" }}>
          👑 Probar como invitado VIP
        </button>

        <p className="auth-back">
          <Link to="/">{t("auth.back")}</Link>
        </p>
      </div>
    </div>
  );
}
