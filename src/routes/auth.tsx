import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import LandingModal from "@/components/LandingModal";
import { ensureGuestVip } from "@/lib/guest.functions";
import { quickAccess } from "@/lib/passwordless.functions";
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
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
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

  const handleGuestVip = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const creds = await ensureGuestVip();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (err) throw err;
      toast.success("¡Bienvenido, Andrés Bilbao! 👑");
      navigate({ to: "/" });
    } catch (err) {
      failWith(err, t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const creds = await quickAccess({
        data: { email: email.trim(), name: displayName.trim() },
      });
      const { error: err } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (err) throw err;
      toast.success(`¡Hola${displayName ? `, ${displayName}` : ""}! ✨`);
      navigate({ to: "/" });
    } catch (err) {
      failWith(err, t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };




  if (showIntro) {
    return <LandingModal onStart={startAuth} />;
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
          <div className="auth-emoji">✨</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#9b7ec9", textTransform: "uppercase", marginBottom: 6 }}>
            IsaRoRo Studio
          </div>
          <h1 className="auth-title">{t("auth.welcomeBack")}</h1>
          <p className="auth-sub">Solo tu correo y tu nombre. Sin contraseñas ✨</p>
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
          <input
            type="text"
            placeholder={t("auth.displayName")}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="auth-input"
            autoComplete="name"
          />
          <input
            type="email"
            placeholder={t("auth.email")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            autoComplete="email"
          />

          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {info && <div className="auth-alert auth-alert-info">{info}</div>}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? "..." : "Entrar / Crear mi cuenta ✨"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGuestVip}
          disabled={loading}
          className="auth-submit-btn"
          style={{
            marginTop: 10,
            background: "linear-gradient(135deg, #ffd980, #ffb3d1)",
            color: "#4a2f5c",
          }}
        >
          👑 Probar como invitado VIP
        </button>

        <p className="auth-back">
          <Link to="/">{t("auth.back")}</Link>
        </p>
      </div>
    </div>
  );
}
