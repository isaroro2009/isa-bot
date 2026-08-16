import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechNews, type TechNewsItem } from "@/lib/techNews.functions";

const TOPICS: Array<{ value: string; label: string }> = [
  { value: "all", label: "🌐 Todo" },
  { value: "ia", label: "🤖 IA" },
  { value: "startups", label: "🚀 Startups" },
  { value: "dev", label: "🧑‍💻 Desarrollo" },
  { value: "gadgets", label: "📱 Gadgets" },
];

const TOPIC_BADGE: Record<string, string> = {
  ia: "🤖 IA",
  startups: "🚀 Startups",
  dev: "🧑‍💻 Dev",
  gadgets: "📱 Gadgets",
  general: "🌐 Tech",
};

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function TechNewsPanel({
  onClose,
}: {
  onClose: () => void;
  onAsk?: (question: string) => void;
}) {
  const load = useServerFn(getTechNews);
  const [items, setItems] = useState<TechNewsItem[]>([]);
  const [digest, setDigest] = useState("");
  const [topic, setTopic] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await load();
        if (!alive) return;
        setItems(res.items);
        setDigest(res.digest);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No pude traer las noticias");
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
        <button className="rewards-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <h3 style={{ margin: "0 0 4px", color: "#7a3fbf" }}>📰 Noticias Tech del Día</h3>
        <p style={{ margin: "0 0 14px", color: "#a06b8a", fontSize: 14 }}>
          Lo más importante del mundo tech, resumido por IsaBot ✨
        </p>

        {digest && <div className="news-digest">{digest}</div>}

        <div className="news-topics">
          {TOPICS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`news-topic ${topic === t.value ? "active" : ""}`}
              onClick={() => setTopic(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className="news-loading">Buscando lo último del día… 🛰️</div>}
        {error && <div className="fb-error">💔 {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="news-loading">Todavía no hay noticias de este tema 🌸</div>
        )}

        <div className="news-list">
          {filtered.slice(0, 30).map((n) => (
            <article key={n.id} className="news-item">
              <div className="news-item-top">
                <span className="news-badge">{TOPIC_BADGE[n.topic] ?? "🌐 Tech"}</span>
                <span className="news-meta">
                  {n.source} · {timeAgo(n.published_at)}
                </span>
              </div>
              <a className="news-title" href={n.url} target="_blank" rel="noopener noreferrer">
                {n.title_es || n.title}
              </a>
              {n.summary && (
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
