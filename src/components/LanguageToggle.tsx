import { useI18n, type Lang } from "@/lib/i18n";

export function LanguageToggle({
  compact = false,
  lang: controlledLang,
  onChange,
}: {
  compact?: boolean;
  lang?: Lang;
  onChange?: (lang: Lang) => void;
}) {
  const { lang, setLang, t } = useI18n();
  const activeLang = controlledLang ?? lang;
  const changeLang = onChange ?? setLang;

  return (
    <div className="lang-toggle" role="group" aria-label={t("common.language")}>
      {(["es", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-toggle-btn ${activeLang === code ? "active" : ""}`}
          aria-pressed={activeLang === code}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            changeLang(code);
          }}
        >
          {code === "es" ? "🇪🇸" : "🇺🇸"}
          {!compact && <span>{code.toUpperCase()}</span>}
        </button>
      ))}
    </div>
  );
}

export default LanguageToggle;
