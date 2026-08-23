import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  submitFeedback,
  listMyFeedback,
  type FeedbackItem,
} from "@/lib/feedback.functions";

const KINDS: Array<{ value: "idea" | "problema" | "amor" | "otro"; label: string }> = [
  { value: "idea", label: "💡 Idea nueva" },
  { value: "problema", label: "🐞 Algo falla" },
  { value: "amor", label: "💖 Me encanta" },
  { value: "otro", label: "✨ Otro" },
];

const STATUS_LABEL: Record<string, string> = {
  new: "🆕 Recibido",
  reviewed: "👀 Revisado",
  planned: "🗓️ Planeado",
  done: "✅ Hecho",
};

export function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const send = useServerFn(submitFeedback);
  const listMine = useServerFn(listMyFeedback);

  const [kind, setKind] = useState<"idea" | "problema" | "amor" | "otro">("idea");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<FeedbackItem[]>([]);

  const load = async () => {
    try {
      setMine(await listMine());
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit() {
    if (message.trim().length < 4 || sending) return;
    setSending(true);
    setError(null);
    setThanks(null);
    try {
      const res = await send({ data: { kind, rating, message: message.trim() } });
      setMessage("");
      setThanks(
        res.awarded > 0
          ? `¡Gracias! 💕 Tu idea ya está en mi lista y te di +${res.awarded} IsaBot Coins 🌟`
          : "¡Gracias! 💕 Tu idea ya está en mi lista.",
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude enviar tu feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card feedback-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rewards-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <h3 style={{ margin: "0 0 4px", color: "#7a3fbf" }}>💡 Tu feedback de IsaBot</h3>
        <p style={{ margin: "0 0 16px", color: "#a06b8a", fontSize: 14 }}>
          Cuéntame qué te gusta, qué falla y qué quieres que le agregue. Leo todo cada semana ✨
        </p>

        <div className="fb-kinds">
          {KINDS.map((k) => (
            <button
              key={k.value}
              className={`fb-kind ${kind === k.value ? "active" : ""}`}
              onClick={() => setKind(k.value)}
              type="button"
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="fb-stars" role="group" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`fb-star ${n <= rating ? "on" : ""}`}
              onClick={() => setRating(n)}
              aria-label={`${n} estrellas`}
            >
              ★
            </button>
          ))}
          <span className="fb-star-label">{rating}/5</span>
        </div>

        <textarea
          className="fb-textarea"
          placeholder="Ej: me encantaría que IsaBot me lea mis notas en voz alta…"
          value={message}
          maxLength={2000}
          rows={5}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
        />

        <button
          className="fb-send"
          onClick={onSubmit}
          disabled={sending || message.trim().length < 4}
        >
          {sending ? "Enviando…" : "💌 Enviar mi feedback"}
        </button>

        {thanks && <div className="fb-thanks">{thanks}</div>}
        {error && <div className="fb-error">💔 {error}</div>}

        {mine.length > 0 && (
          <div className="fb-history">
            <h4>📚 Lo que ya me enviaste</h4>
            {mine.map((f) => (
              <div key={f.id} className="fb-item">
                <div className="fb-item-top">
                  <span>{KINDS.find((k) => k.value === f.kind)?.label ?? f.kind}</span>
                  <span className="fb-item-status">{STATUS_LABEL[f.status] ?? f.status}</span>
                </div>
                <p>{f.message}</p>
                <small>
                  {"★".repeat(f.rating)} · {new Date(f.created_at).toLocaleDateString()}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
