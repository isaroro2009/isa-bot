import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import heroScene from "@/assets/academy-hero.jpg";
import guideBot from "@/assets/academy-guide.png";
import owlBot from "@/assets/academy-owl.png";
import {
  getAcademy,
  getLesson,
  submitLesson,
  explainLesson,
  type AcademyState,
  type LessonDetail,
  type LessonMeta,
  type SubmitResult,
} from "@/lib/academy.functions";
import {
  generateCustomCourse,
  type GeneratedCourse,
} from "@/lib/creative-ai.functions";

const TRACK_HUES = ["#f472b6", "#a78bfa", "#38bdf8", "#fbbf24", "#34d399", "#fb7185"];

export function AcademyPanel({
  onClose,
  onUpgrade,
  displayName,
}: {
  onClose: () => void;
  onUpgrade?: () => void;
  displayName?: string;
}) {
  const load = useServerFn(getAcademy);
  const openLesson = useServerFn(getLesson);
  const send = useServerFn(submitLesson);
  const askTutor = useServerFn(explainLesson);
  const createCourse = useServerFn(generateCustomCourse);

  const [state, setState] = useState<AcademyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sending, setSending] = useState(false);
  const [tutor, setTutor] = useState<string | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [courseTopic, setCourseTopic] = useState("");
  const [customCourse, setCustomCourse] = useState<GeneratedCourse | null>(null);
  const [customAnswers, setCustomAnswers] = useState<number[]>([]);
  const [customChecked, setCustomChecked] = useState(false);
  const [customPassed, setCustomPassed] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = await load();
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude abrir la academia");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(l: LessonMeta) {
    if (l.locked) {
      onUpgrade?.();
      return;
    }
    setResult(null);
    setTutor(null);
    setAnswers([]);
    try {
      const d = await openLesson({ data: { id: l.id } });
      setLesson(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude abrir la lección");
    }
  }

  async function finish() {
    if (!lesson || sending) return;
    setSending(true);
    try {
      const r = await send({ data: { id: lesson.id, answers } });
      setResult(r);
      if (r.ok) void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude enviar el quiz");
    } finally {
      setSending(false);
    }
  }

  async function doubt() {
    if (!lesson || tutorLoading) return;
    setTutorLoading(true);
    try {
      const r = await askTutor({ data: { id: lesson.id } });
      setTutor(r.text);
    } catch {
      setTutor("El tutor no está disponible ahora 🥺");
    } finally {
      setTutorLoading(false);
    }
  }

  async function buildCourse() {
    const topic = courseTopic.trim();
    if (topic.length < 5 || courseLoading) return;
    setCourseLoading(true);
    setCourseError(null);
    setCustomChecked(false);
    setCustomPassed(false);
    setCustomAnswers([]);
    try {
      setCustomCourse(await createCourse({ data: { topic } }));
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "No pude crear el curso ahora mismo.");
    } finally {
      setCourseLoading(false);
    }
  }

  function checkCustomQuiz() {
    if (!customCourse || customAnswers.length < customCourse.questions.length) return;
    const correct = customCourse.questions.filter((q, index) => customAnswers[index] === q.answer).length;
    setCustomPassed(correct / customCourse.questions.length >= 0.6);
    setCustomChecked(true);
  }

  const totalLessons = (state?.tracks ?? []).reduce((a, t) => a + t.lessons.length, 0);
  const totalDone = (state?.tracks ?? []).reduce((a, t) => a + t.doneCount, 0);
  const allDone = totalLessons > 0 && totalDone === totalLessons;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card academy-modal acad3" onClick={(e) => e.stopPropagation()}>
        <button className="rewards-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        <div className="acad3-hero">
          <img
            src={heroScene}
            alt="Campus 3D de IsaAcademy"
            className="acad3-hero-img"
            loading="lazy"
            width={1536}
            height={640}
          />
          <div className="acad3-hero-clouds" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="acad3-hero-text">
            <h3>🎓 IsaAcademy</h3>
            <p>Clases cortitas de IA y Tech, con quiz, XP y racha diaria ✨</p>
          </div>
        </div>

        {loading && <div className="news-loading">Preparando tus clases… 📚</div>}
        {error && <div className="fb-error">💔 {error}</div>}

        {state && !lesson && !customCourse && (
          <>
            <div className="acad3-chips">
              <div className="acad3-chip fire">
                <b>🔥 {state.streak}</b>
                <span>racha</span>
              </div>
              <div className="acad3-chip xp">
                <b>⭐ {state.totalXp}</b>
                <span>XP</span>
              </div>
              <div className="acad3-chip done">
                <b>
                  📚 {totalDone}/{totalLessons}
                </b>
                <span>lecciones</span>
              </div>
              <div className="acad3-chip hearts">
                <b>
                  💜{" "}
                  {state.dailyLimit === null
                    ? "∞"
                    : Math.max(0, state.dailyLimit - state.lessonsToday)}
                </b>
                <span>hoy</span>
              </div>
            </div>

            {state.dailyLimit !== null && (
              <div className="acad-freebar">
                Plan gratis: la ruta 🤖 <b>Fundamentos de IA</b> es ilimitada y tienes{" "}
                <b>{Math.max(0, state.dailyLimit - state.lessonsToday)}</b> lecciones más hoy en las
                otras rutas.{" "}
                <button type="button" className="acad-link" onClick={onUpgrade}>
                  Pasar a Premium ✨
                </button>
              </div>
            )}

            <section className="acad-custom-course">
              <div className="acad-custom-head">
                <div>
                  <span>✨ Curso a tu medida</span>
                  <h4>¿Qué quieres aprender hoy?</h4>
                </div>
                <b>{customPassed ? "100%" : "0%"}</b>
              </div>
              <textarea
                value={courseTopic}
                maxLength={500}
                rows={3}
                placeholder="Ej: Quiero aprender a crear mi primera tienda online, desde la idea hasta publicar productos"
                onChange={(event) => setCourseTopic(event.target.value)}
              />
              <button
                type="button"
                className="acad-custom-create"
                onClick={buildCourse}
                disabled={courseLoading || courseTopic.trim().length < 5}
              >
                {courseLoading ? "Creando tu curso…" : "Crear curso personalizado"}
              </button>
              {courseError && <p className="acad-custom-error">{courseError}</p>}
            </section>

            {state.tracks.map((t, ti) => {
              const hue = TRACK_HUES[ti % TRACK_HUES.length]!;
              const pct = t.lessons.length
                ? Math.round((t.doneCount / t.lessons.length) * 100)
                : 0;
              const currentIdx = t.lessons.findIndex((l) => !l.done && !l.locked);
              return (
                <section
                  key={t.slug}
                  className="acad3-island"
                  style={{ ["--track" as string]: hue }}
                >
                  <header className="acad3-island-head">
                    <div>
                      <h4>
                        {t.emoji} {t.title}
                        {t.premium && !state.isPremium && <span className="acad-pro">Premium</span>}
                      </h4>
                      <p>{t.description}</p>
                    </div>
                    <span className="acad3-island-count">
                      {t.doneCount}/{t.lessons.length}
                    </span>
                  </header>
                  <div className="acad3-progress">
                    <span style={{ width: `${pct}%` }} />
                  </div>

                  <div className="acad3-path">
                    <img
                      src={ti % 2 === 0 ? guideBot : owlBot}
                      alt=""
                      aria-hidden="true"
                      className={`acad3-mascot ${ti % 2 === 0 ? "left" : "right"}`}
                      loading="lazy"
                      width={816}
                      height={816}
                    />
                    {t.lessons.map((l, li) => {
                      const offsets = [0, 1, 2, 1, 0, -1, -2, -1];
                      const off = offsets[li % offsets.length]!;
                      const isCurrent = li === currentIdx;
                      return (
                        <div
                          key={l.id}
                          className="acad3-step"
                          style={{ transform: `translateX(${off * 24}px)` }}
                        >
                          <button
                            type="button"
                            className={`acad3-node ${l.done ? "done" : ""} ${
                              l.locked ? "locked" : ""
                            } ${isCurrent ? "current" : ""}`}
                            onClick={() => open(l)}
                            title={l.title}
                            aria-label={l.title}
                          >
                            <span className="acad3-node-emoji">
                              {l.locked ? "🔒" : l.done ? "✅" : l.emoji}
                            </span>
                          </button>
                          {isCurrent && <span className="acad3-flag">EMPEZAR</span>}
                          <span className="acad3-node-label">
                            {l.title}
                            <b>+{l.xp} XP</b>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {state.isPremium && (
              <button
                type="button"
                className="acad-cert-btn"
                onClick={() => setShowCert(true)}
                disabled={!allDone}
              >
                {allDone
                  ? "📜 Descargar mi certificado"
                  : `📜 Certificado (te faltan ${totalLessons - totalDone} lecciones)`}
              </button>
            )}
          </>
        )}

        {lesson && (
          <div className="acad-lesson">
            <button type="button" className="acad-back" onClick={() => setLesson(null)}>
              ← Volver al mapa
            </button>

            <div className="acad3-lesson-head">
              <span className="acad3-node big">
                <span className="acad3-node-emoji">{lesson.emoji}</span>
              </span>
              <h4 className="acad-lesson-title">{lesson.title}</h4>
              <img
                src={guideBot}
                alt=""
                aria-hidden="true"
                className="acad3-lesson-mascot"
                loading="lazy"
                width={816}
                height={816}
              />
            </div>

            <div className="acad-lesson-body">
              {lesson.body.split(/\n\n+/).map((p, i) => (
                <p key={i} className="acad-lesson-p">
                  <span className="acad-bullet" aria-hidden="true">
                    {["✨", "💡", "🌸", "🚀", "🎯"][i % 5]}
                  </span>
                  {p}
                </p>
              ))}
            </div>

            <button type="button" className="acad-doubt" onClick={doubt} disabled={tutorLoading}>
              {tutorLoading ? "IsaBot está pensando…" : "🙋 No entendí, explícame más simple"}
            </button>
            {tutor && (
              <div className="acad-tutor">
                <img
                  src={owlBot}
                  alt=""
                  aria-hidden="true"
                  className="acad-tutor-mascot"
                  loading="lazy"
                  width={816}
                  height={816}
                />
                <span>{tutor}</span>
              </div>
            )}

            <div className="acad-quiz">
              <h5>🧪 Mini quiz</h5>

              {lesson.questions.map((q, qi) => (
                <div key={qi} className="acad-q">
                  <p className="acad-q-text">
                    {qi + 1}. {q.q}
                  </p>
                  {q.options.map((op, oi) => {
                    const chosen = answers[qi] === oi;
                    const r = result?.results?.[qi];
                    const isRight = r && r.answer === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        className={`acad-opt ${chosen ? "chosen" : ""} ${
                          result ? (isRight ? "right" : chosen ? "wrong" : "") : ""
                        }`}
                        onClick={() => {
                          if (result) return;
                          const next = [...answers];
                          next[qi] = oi;
                          setAnswers(next);
                        }}
                      >
                        {op}
                      </button>
                    );
                  })}
                  {result?.results?.[qi]?.explain && (
                    <p className="acad-explain">💡 {result.results[qi]!.explain}</p>
                  )}
                </div>
              ))}

              {!result && (
                <button
                  type="button"
                  className="acad-send"
                  onClick={finish}
                  disabled={sending || answers.filter((a) => a >= 0).length < lesson.questions.length}
                >
                  {sending ? "Revisando…" : "Terminar lección"}
                </button>
              )}

              {result?.limitReached && (
                <div className="acad-limit">
                  Llegaste a tus <b>5 lecciones gratis de hoy</b> 🥺 La ruta 🤖 Fundamentos de IA
                  sigue abierta, o pasa a Premium para lecciones ilimitadas.
                  <button type="button" className="acad-link" onClick={onUpgrade}>
                    Ver Premium ✨
                  </button>
                </div>
              )}

              {result?.ok && (
                <div className={`acad-result ${result.passed ? "pass" : "fail"}`}>
                  {result.passed && (
                    <div className="acad3-confetti" aria-hidden="true">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span key={i} style={{ ["--i" as string]: i }} />
                      ))}
                    </div>
                  )}
                  {result.passed ? (
                    <>
                      🎉 ¡Lección superada! {result.correct}/{result.total} correctas · +
                      {result.xpEarned} XP · 🔥 racha {result.streak}
                    </>
                  ) : (
                    <>
                      Casi 🥺 {result.correct}/{result.total} correctas. Lee las explicaciones y
                      vuelve a intentarlo.
                    </>
                  )}
                  <button
                    type="button"
                    className="acad-send"
                    onClick={() => {
                      setLesson(null);
                      setResult(null);
                    }}
                  >
                    Seguir aprendiendo →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {customCourse && !lesson && (
          <div className="acad-lesson acad-custom-module">
            <button type="button" className="acad-back" onClick={() => setCustomCourse(null)}>
              ← Volver al mapa
            </button>
            <div className="acad3-lesson-head">
              <span className="acad3-node big"><span className="acad3-node-emoji">{customCourse.emoji}</span></span>
              <h4 className="acad-lesson-title">{customCourse.title}</h4>
            </div>
            <div className="acad-custom-progress" aria-label={`Progreso ${customPassed ? 100 : 0}%`}>
              <span style={{ width: customPassed ? "100%" : "0%" }} />
            </div>
            <div className="acad-lesson-body">
              {customCourse.body.map((paragraph, index) => (
                <p key={index} className="acad-lesson-p">
                  <span className="acad-bullet" aria-hidden="true">{["✨", "💡", "🌸", "🚀", "🎯"][index % 5]}</span>
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="acad-quiz">
              <h5>🧪 Quiz final</h5>
              {customCourse.questions.map((question, questionIndex) => (
                <div key={questionIndex} className="acad-q">
                  <p className="acad-q-text">{questionIndex + 1}. {question.q}</p>
                  {question.options.map((option, optionIndex) => {
                    const chosen = customAnswers[questionIndex] === optionIndex;
                    const right = customChecked && question.answer === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        className={`acad-opt ${chosen ? "chosen" : ""} ${right ? "right" : customChecked && chosen ? "wrong" : ""}`}
                        disabled={customChecked}
                        onClick={() => {
                          const next = [...customAnswers];
                          next[questionIndex] = optionIndex;
                          setCustomAnswers(next);
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                  {customChecked && <p className="acad-explain">💡 {question.explain}</p>}
                </div>
              ))}
              {!customChecked && (
                <button
                  type="button"
                  className="acad-send"
                  onClick={checkCustomQuiz}
                  disabled={customAnswers.filter((answer) => answer >= 0).length < customCourse.questions.length}
                >
                  Terminar módulo
                </button>
              )}
              {customChecked && !customPassed && (
                <div className="acad-result fail">
                  Repasa las explicaciones e inténtalo otra vez.
                  <button type="button" className="acad-send" onClick={() => { setCustomChecked(false); setCustomAnswers([]); }}>
                    Reintentar quiz
                  </button>
                </div>
              )}
            </div>
            {customPassed && (
              <div className="acad-inline-certificate">
                <p className="acad-cert-kicker">IsaRoRo Studio · IsaAcademy</p>
                <h2>Certificado de Finalización</h2>
                <p className="acad-cert-name">{displayName || "Estudiante de IsaAcademy"}</p>
                <p className="acad-cert-text">completó satisfactoriamente el curso personalizado</p>
                <strong>{customCourse.title}</strong>
                <p className="acad-cert-sign">Isabella Rodríguez Roque · Fundadora de IsaRoRo Studio</p>
                <p className="acad-cert-date">{new Date().toLocaleDateString("es-ES")}</p>
                <button type="button" className="acad-send" onClick={() => window.print()}>🖨️ Guardar como PDF</button>
              </div>
            )}
          </div>
        )}

        {showCert && state && (
          <div className="acad-cert-overlay" onClick={() => setShowCert(false)}>
            <div className="acad-cert" onClick={(e) => e.stopPropagation()}>
              <div className="acad-cert-inner" id="isa-certificate">
                <p className="acad-cert-kicker">IsaRoRo Studio · IsaAcademy</p>
                <h2>Certificado de finalización</h2>
                <p className="acad-cert-name">{displayName || "Estudiante de IsaAcademy"}</p>
                <p className="acad-cert-text">
                  completó las {totalLessons} lecciones de IsaAcademy en IA, Prompting,
                  Programación y No-code, acumulando {state.totalXp} XP.
                </p>
                <p className="acad-cert-sign">
                  Isabella Rodríguez Roque · Fundadora de IsaRoRo Studio
                </p>
                <p className="acad-cert-date">{new Date().toLocaleDateString("es-ES")}</p>
              </div>
              <button type="button" className="acad-send" onClick={() => window.print()}>
                🖨️ Guardar como PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
