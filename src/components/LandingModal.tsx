import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

export function LandingModal() {
  const { t } = useI18n();


  const features = [
    { title: t("landing.f1t"), desc: t("landing.f1d") },
    { title: t("landing.f2t"), desc: t("landing.f2d") },
    { title: t("landing.f3t"), desc: t("landing.f3d") },
    { title: t("landing.f4t"), desc: t("landing.f4d") },
  ];

  return (
    <div className="modal-overlay landing-overlay">
      <div className="settings-card landing-card" onClick={(e) => e.stopPropagation()}>
        <div className="landing-top">
          <span className="landing-brand">IsaRoRo Studio</span>
          <LanguageToggle compact />
        </div>

        <div className="landing-hero">
          <div className="landing-emoji">✨</div>
          <h2 className="landing-title">{t("landing.title")}</h2>
          <p className="landing-tagline">{t("landing.tagline")}</p>
        </div>

        <div className="landing-grid">
          {features.map((f) => (
            <div key={f.title} className="landing-feature">
              <b>{f.title}</b>
              <span>{f.desc}</span>
            </div>
          ))}
        </div>

        <div className="landing-actions">
          <Link to="/auth" className="landing-btn primary">
            {t("landing.cta")}
          </Link>
        </div>

        <Link to="/auth" className="landing-signup">
          {t("landing.signup")}
        </Link>
      </div>
    </div>
  );
}

export default LandingModal;
