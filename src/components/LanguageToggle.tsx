import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-toggle" role="group" aria-label={t("common.language")}>
      {(["es", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-toggle-btn ${lang === code ? "active" : ""}`}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code === "es" ? "🇪🇸" : "🇺🇸"}
          {!compact && <span>{code.toUpperCase()}</span>}
        </button>
      ))}
    </div>
  );
}

export default LanguageToggle;
