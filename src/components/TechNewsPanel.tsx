import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechNews, type TechNewsItem } from "@/lib/techNews.functions";
import { useI18n, timeAgo } from "@/lib/i18n";

export function TechNewsPanel({
  onClose,
}: {
  onClose: () => void;
  onAsk?: (question: string) => void;
}) {
  const load = useServerFn(getTechNews);
  const { lang, t } = useI18n();
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
        <h3 style={{ margin: "0 0 4px", color: "#7a3fbf" }}>{t("news.title")}</h3>
        <p style={{ margin: "0 0 14px", color: "#a06b8a", fontSize: 14 }}>{t("news.sub")}</p>

        {digest && lang === "es" && <div className="news-digest">{digest}</div>}

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
              {n.summary && lang === "es" && (
                <p className="news-summary">
                  <span className="news-by">IsaBot</span> {n.summary}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
