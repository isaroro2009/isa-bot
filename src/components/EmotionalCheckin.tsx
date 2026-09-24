import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitEmotional, lastEmotional } from "@/lib/emotional.functions";

const MOODS = [
  { v: "feliz", e: "🥰", l: "Feliz" },
  { v: "bien", e: "🙂", l: "Bien" },
  { v: "normal", e: "😐", l: "Normal" },
  { v: "confundida", e: "😕", l: "Confundida" },
  { v: "frustrada", e: "😣", l: "Frustrada" },
] as const;

const PROMPTS = [
  "Oye, ¿cómo te has sentido hoy usando IsaBot? 💕",
  "Me encantaría saber qué tal va tu experiencia conmigo hoy ✨",
  "Pausa rapidita: ¿cómo te sientes con la plataforma? 🌸",
];

const DAY_KEY = "isabot.emotional.lastAsk";

/** IsaBot pregunta amablemente, máximo una vez al día, cómo se siente la persona. */
export function EmotionalCheckin() {
  const submit = useServerFn(submitEmotional);
  const getLast = useServerFn(lastEmotional);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(DAY_KEY) === today) return;
    } catch { /* noop */ }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { last } = await getLast();
        if (last && last.slice(0, 10) === today) return;
        if (!cancelled) setOpen(true);
      } catch { /* noop */ }
    }, 90_000); // tras un rato de uso, de forma natural
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    try { localStorage.setItem(DAY_KEY, new Date().toISOString().slice(0, 10)); } catch { /* noop */ }
    setOpen(false);
  };

  const send = async () => {
    if (!mood) return;
    try {
      await submit({ data: { mood, message: msg.trim() || undefined } });
      setDone(true);
      setTimeout(close, 2200);
    } catch { close(); }
  };

  if (!open) return null;
  return (
    <div className="emo-card" role="dialog" aria-label="¿Cómo te sientes?">
      <button className="emo-x" onClick={close} aria-label="Ahora no">✕</button>
      {done ? (
        <p className="emo-q">¡Gracias por contarme! 💜 Lo tendré muy en cuenta.</p>
      ) : (
        <>
          <p className="emo-q">🤖 {prompt}</p>
          <div className="emo-moods">
            {MOODS.map((m) => (
              <button key={m.v} className={`emo-mood ${mood === m.v ? "on" : ""}`} onClick={() => setMood(m.v)}>
                <span>{m.e}</span><small>{m.l}</small>
              </button>
            ))}
          </div>
          {mood && (
            <>
              <textarea className="emo-text" rows={2} maxLength={1000} placeholder="¿Quieres contarme algo más? (opcional)"
                value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button className="emo-send" onClick={send}>Enviar 💌</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
