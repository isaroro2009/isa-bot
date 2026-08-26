import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import "../isabot.css";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "IsaBot — Restablecer contraseña" },
      {
        name: "description",
        content: "Crea una nueva contraseña para tu cuenta de IsaBot y vuelve a tu copiloto de IA creativa.",
      },
      { property: "og:title", content: "IsaBot — Restablecer contraseña" },
      { property: "og:description", content: "Define una nueva contraseña segura para entrar a IsaBot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      toast.success(t("reset.done"));
      setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.genericError");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-emoji">🔑</div>
          <h1 className="auth-title">{t("reset.title")}</h1>
          <p className="auth-sub">{t("reset.sub")}</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <input
            type="password"
            placeholder={t("reset.newPassword")}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            autoComplete="new-password"
          />

          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {done && <div className="auth-alert auth-alert-info">{t("reset.done")}</div>}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? "..." : t("reset.save")}
          </button>
        </form>

        <p className="auth-back">
          <Link to="/auth">{t("reset.back")}</Link>
        </p>
      </div>
    </div>
  );
}
