import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechNews, type TechNewsItem } from "@/lib/techNews.functions";
import { translate, useI18n, timeAgo, type Lang } from "@/lib/i18n";

export function TechNewsPanel({
  onClose,
  lang: forcedLang,
}: {
  onClose: () => void;
  onAsk?: (question: string) => void;
  lang?: Lang;
}) {
  const load = useServerFn(getTechNews);
  const { lang: contextLang } = useI18n();
  const [newsLang, setNewsLang] = useState<Lang>(forcedLang ?? contextLang);
  const lang = newsLang;
  const t = (key: string) => translate(key, lang);
  const [items, setItems] = useState<TechNewsItem[]>([]);
  const [digest, setDigest] = useState("");
  const [topic, setTopic] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const TOPICS = [
    { value: "all", label: t("news.all") },
    { value: "ia", label: t("news.ia") },
    { value: "startups", label: t("news.startups") },
    { value: "dev", label: t("news.dev") },
    { value: "gadgets", label: t("news.gadgets") },
  ];

  const badge = (topicKey: string) =>
    topicKey === "ia"
      ? t("news.ia")
      : topicKey === "startups"
        ? t("news.startups")
        : topicKey === "dev"
          ? t("news.dev")
          : topicKey === "gadgets"
            ? t("news.gadgets")
            : t("news.general");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await load();
        if (!alive) return;
        setItems(res.items);
        setDigest(res.digest);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t("news.error"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (topic === "all" ? items : items.filter((i) => i.topic === topic)),
    [items, topic],
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card news-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rewards-close" onClick={onClose} aria-label={t("news.close")}>
          ✕
        </button>
        <div className="news-head">
          <div>
            <h3>{t("news.title")}</h3>
            <p>{t("news.sub")}</p>
          </div>
          <div className="news-language" role="group" aria-label="Idioma de las noticias">
            <button
              type="button"
              className={newsLang === "en" ? "active" : ""}
              aria-pressed={newsLang === "en"}
              onClick={() => setNewsLang("en")}
            >
              Inglés
            </button>
            <button
              type="button"
              className={newsLang === "es" ? "active" : ""}
              aria-pressed={newsLang === "es"}
              onClick={() => setNewsLang("es")}
            >
              Español
            </button>
          </div>
        </div>


        <div className="news-topics">
          {TOPICS.map((tp) => (
            <button
              key={tp.value}
              type="button"
              className={`news-topic ${topic === tp.value ? "active" : ""}`}
              onClick={() => setTopic(tp.value)}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {loading && <div className="news-loading">{t("news.loading")}</div>}
        {error && <div className="fb-error">💔 {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="news-loading">{t("news.empty")}</div>
        )}

        <div className="news-list">
          {filtered.slice(0, 30).map((n) => (
            <article key={n.id} className="news-item">
              <div className="news-item-top">
                <span className="news-badge">{badge(n.topic)}</span>
                <span className="news-meta">
                  {n.source} · {timeAgo(n.published_at, lang)}
                </span>
              </div>
              <a className="news-title" href={n.url} target="_blank" rel="noopener noreferrer">
                {lang === "en" ? n.title : n.title_es || n.title}
              </a>
              {(lang === "es" ? n.content_es || n.content : n.content) && (
                <p className="news-content">{lang === "es" ? n.content_es || n.content : n.content}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
