import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import LandingModal from "@/components/LandingModal";
import "../isabot.css";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "IsaBot — Co-piloto de IA Creativa para Estudiantes y Emprendedores" },
      { name: "description", content: "IsaBot es tu co-piloto de IA creativa: estudia mejor, emprende con foco y crea sin bloqueo. Un espacio hecho en IsaRoRo Studio." },
      { property: "og:title", content: "IsaBot — Inicia sesión" },
      { property: "og:description", content: "Entra a IsaBot con tu correo o explora como invitada: PDFs agénticos, rachas diarias, IsaBot Coins y noticias tech." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Primero contamos qué es IsaBot; el formulario aparece al pulsar el CTA.
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("isabot_intro_seen")) setShowIntro(false);
    } catch {
      /* almacenamiento bloqueado */
    }
  }, []);

  const startAuth = () => {
    try {
      window.sessionStorage.setItem("isabot_intro_seen", "1");
    } catch {
      /* noop */
    }
    setShowIntro(false);
  };

  const handleForgot = async () => {
    if (!email) {
      setError(t("auth.forgotNeedEmail"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setInfo(t("auth.forgotSent"));
      toast.success(t("auth.forgotSent"));
    } catch (err) {
      failWith(err, t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // iOS Safari con "Prevenir rastreo entre sitios" puede bloquear el
    // almacenamiento: avisamos en vez de dejar el login congelado.
    try {
      const k = "__isabot_storage_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
    } catch {
      toast.error(t("auth.storageBlocked"), { duration: 9000 });
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) navigate({ to: "/" });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const failWith = (err: unknown, fallback: string) => {
    const raw = err instanceof Error ? err.message : String(err ?? fallback);
    const friendly = /invalid login credentials/i.test(raw)
      ? t("auth.badCreds")
      : /email not confirmed/i.test(raw)
        ? t("auth.notConfirmed")
        : /storage|localStorage|quota|cookie/i.test(raw)
          ? t("auth.storageBlocked")
          : /network|fetch|timeout/i.test(raw)
            ? t("auth.network")
            : raw || fallback;
    setError(friendly);
    toast.error(friendly, { duration: 7000 });
  };

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
        toast.success(t("auth.created"));
        setInfo(t("auth.created"));
        setMode("signin");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/" });
      }
    } catch (err) {
      failWith(err, t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };




  return (
    <div className="auth-page">
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />

      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <LanguageToggle />
        </div>
        <div className="auth-header">
          <div className="auth-emoji">✨</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#9b7ec9", textTransform: "uppercase", marginBottom: 6 }}>
            IsaRoRo Studio
          </div>
          <h1 className="auth-title">
            {mode === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h1>
          <p className="auth-sub">
            {mode === "signin" ? t("auth.subSignin") : t("auth.subSignup")}
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
            {[t("auth.chip1"), t("auth.chip2"), t("auth.chip3")].map((chip) => (
              <span key={chip} style={{
                fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                background: "rgba(201, 182, 255, 0.22)", color: "#5b4270",
              }}>{chip}</span>
            ))}
          </div>
        </div>




        <form onSubmit={handleEmailAuth} className="auth-form">
          {mode === "signup" && (
            <>
              <input
                type="text"
                placeholder={t("auth.displayName")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="auth-input"
              />
              <input
                type="tel"
                placeholder={t("auth.phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="auth-input"
              />
            </>
          )}
          <input
            type="email"
            placeholder={t("auth.email")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            autoComplete="email"
          />
          <input
            type="password"
            placeholder={t("auth.password")}
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
            {loading ? "..." : mode === "signin" ? t("auth.signin") : t("auth.signup")}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="auth-switch-btn"
          >
            {mode === "signin" ? t("auth.register") : t("auth.signin")}
          </button>
        </p>

        <p className="auth-back">
          <Link to="/">{t("auth.back")}</Link>
        </p>
      </div>
    </div>
  );
}
