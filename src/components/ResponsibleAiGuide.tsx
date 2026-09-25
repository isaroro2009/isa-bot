import { useState } from "react";
import "./guide.css";

const LESSONS = [
  {
    icon: "🧠",
    title: "Piensa primero, pregunta después",
    tips: [
      "Antes de preguntarle a la IA, intenta responder tú: escribe lo que ya sabes.",
      "Usa la IA para entender el porqué, no solo para obtener la respuesta.",
      "Si no entiendes su explicación, pídele un ejemplo más sencillo.",
    ],
  },
  {
    icon: "🧑‍✈️",
    title: "La IA es tu copiloto, no el piloto",
    tips: [
      "✅ Bien: «Explícame cómo se resuelve una ecuación paso a paso».",
      "❌ Evita: «Hazme la tarea de matemáticas» y copiarla tal cual.",
      "Pídele que te haga preguntas o un mini-quiz para practicar.",
      "Tu voz y tus ideas importan: úsala para mejorar tu trabajo, no para reemplazarlo.",
    ],
  },
  {
    icon: "🔍",
    title: "Verifica siempre las fuentes",
    tips: [
      "La IA puede equivocarse o inventar datos con total seguridad.",
      "Contrasta con al menos 2 fuentes confiables: libros, sitios .edu/.gov, enciclopedias.",
      "Pregunta: «¿De dónde sale este dato?» y revisa si existe de verdad.",
      "Desconfía de fechas, cifras y citas exactas hasta comprobarlas.",
    ],
  },
  {
    icon: "🛡️",
    title: "Cuida tu privacidad",
    tips: [
      "Nunca compartas contraseñas, dirección, teléfono ni datos de tu colegio.",
      "No subas fotos de otras personas sin su permiso.",
      "Si algo te incomoda o te asusta, habla con un adulto de confianza.",
    ],
  },
  {
    icon: "⚖️",
    title: "Usa la IA con ética",
    tips: [
      "Sé honesto: si la IA te ayudó, dilo a tu profe.",
      "No crees contenido para burlarte, engañar o dañar a otros.",
      "La IA puede tener sesgos: piensa si una respuesta es justa con todos.",
      "Toma descansos: la tecnología es mejor en equilibrio con la vida real 🌿.",
    ],
  },
];

const QUIZ = [
  { q: "Tienes que escribir un ensayo. ¿Qué es lo más responsable?", options: ["Pedirle a la IA que lo escriba y entregarlo", "Pedirle ideas y un esquema, y escribirlo tú", "No hacerlo"], ok: 1 },
  { q: "La IA te da un dato histórico muy específico. ¿Qué haces?", options: ["Lo copio, la IA nunca falla", "Lo verifico en otras fuentes confiables", "Lo invento distinto"], ok: 1 },
  { q: "¿Qué información NO debes compartir con una IA?", options: ["Tu contraseña y dirección", "Tu tema favorito de ciencias", "Tu duda de matemáticas"], ok: 0 },
  { q: "¿Cuál es la mejor forma de aprender con IA?", options: ["Que me dé solo respuestas", "Que me explique, me haga preguntas y me ponga a practicar", "Usarla todo el día sin pausas"], ok: 1 },
];

export function ResponsibleAiGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const inQuiz = step >= LESSONS.length;
  const score = QUIZ.reduce((s, q, i) => s + (answers[i] === q.ok ? 1 : 0), 0);
  const allAnswered = Object.keys(answers).length === QUIZ.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h3>🌱 Guía de IA Responsable</h3>
          <button className="guide-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="guide-sub">Uso consciente de la inteligencia artificial para estudiantes, niños y adolescentes.</p>

        <div className="guide-dots">
          {[...LESSONS, { icon: "🏆", title: "Quiz" }].map((l, i) => (
            <button key={i} className={`guide-dot ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => setStep(i)} title={l.title}>
              {l.icon}
            </button>
          ))}
        </div>

        {!inQuiz ? (
          <div className="guide-card">
            <h4>{LESSONS[step].icon} {LESSONS[step].title}</h4>
            <ul>{LESSONS[step].tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ) : (
          <div className="guide-card">
            <h4>🏆 Pon a prueba lo aprendido</h4>
            {QUIZ.map((q, i) => (
              <div key={i} className="guide-q">
                <p>{i + 1}. {q.q}</p>
                {q.options.map((o, j) => {
                  const picked = answers[i] === j;
                  const cls = picked ? (j === q.ok ? "ok" : "bad") : "";
                  return (
                    <button key={j} className={`guide-opt ${cls}`} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}>
                      {o}
                    </button>
                  );
                })}
              </div>
            ))}
            {allAnswered && (
              <p className="guide-result">
                {score === QUIZ.length ? "🌟 ¡Perfecto! Eres una persona usuaria consciente de la IA." : `Obtuviste ${score}/${QUIZ.length}. Repasa las lecciones y vuelve a intentarlo 💪`}
              </p>
            )}
          </div>
        )}

        <div className="guide-nav">
          <button className="guide-btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Anterior</button>
          {!inQuiz && <button className="guide-btn" onClick={() => setStep((s) => s + 1)}>Siguiente →</button>}
        </div>
      </div>
    </div>
  );
}
