// 📴 Modo sin señal — respuestas guardadas y cola de mensajes.
// Funciona aunque no se haya descargado el cerebro local.

export type QueuedMessage = { id: string; text: string; at: number };

const QUEUE_KEY = "isabot_offline_queue";

export function loadQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? (JSON.parse(raw) as QueuedMessage[]) : [];
    return Array.isArray(arr) ? arr.slice(-20) : [];
  } catch {
    return [];
  }
}

export function saveQueue(q: QueuedMessage[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-20)));
  } catch {
    /* ignore */
  }
}

export function clearQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

type Faq = { match: RegExp; answer: string };

const FAQS: Faq[] = [
  {
    match: /\b(qui[eé]n\s+(te\s+)?cre[oó]|qui[eé]n\s+eres|c[oó]mo\s+te\s+llamas|tu\s+creador[a]?)\b/i,
    answer:
      "Soy **IsaBot**, creada por **Isabella Rodríguez Roque** en IsaRoRo Studio 💜 Ahora mismo estás sin señal, así que te respondo desde tu propio dispositivo.",
  },
  {
    match: /\b(qu[eé]\s+(puedes|sabes)\s+hacer|funciones|para\s+qu[eé]\s+sirves|ayuda)\b/i,
    answer:
      "Sin conexión puedo acompañarte con lo que ya está en tu dispositivo:\n\n- 💬 Ver tus chats guardados\n- 📝 Notas rápidas y tareas\n- 🎓 Lecciones ya abiertas de IsaAcademy\n- 📴 Chatear con **IsaBot Local** si descargaste el mini-cerebro\n\nCuando vuelva la señal se envía solito lo que escribiste 💕",
  },
  {
    match: /\b(sin\s+(internet|se[ñn]al|wifi|datos)|offline|modo\s+avi[oó]n)\b/i,
    answer:
      "Estás en **Modo sin señal** 📴 Tus mensajes quedan en cola y se envían automáticamente cuando vuelva el internet. Si quieres respuestas de IA aquí mismo, activa **📴 IsaBot Local** en ⚙️ Ajustes → Cerebro de IA (se descarga una sola vez).",
  },
  {
    match: /\b(hola|buenas|hey|holi|qu[eé]\s+tal)\b/i,
    answer:
      "¡Hola! 💜 Estoy en Modo sin señal, pero aquí sigo contigo. Puedo guardar tus mensajes para enviarlos cuando haya internet, o responderte con el cerebro local si lo descargas 🌸",
  },
  {
    match: /\b(gracias|te\s+quiero|eres\s+lind[ao])\b/i,
    answer: "¡Gracias a ti! 🌸 Aquí estaré, con o sin señal 💜",
  },
];

/** Respuesta guardada para preguntas frecuentes cuando no hay conexión. */
export function offlineAnswer(text: string): string {
  const found = FAQS.find((f) => f.match.test(text));
  if (found) return found.answer;
  return "📴 Estás sin señal, así que guardé tu mensaje y lo envío en cuanto vuelva el internet 💕\n\nSi quieres que te responda **ahora mismo sin conexión**, activa **📴 IsaBot Local** en ⚙️ Ajustes → Cerebro de IA: se descarga una sola vez y luego funciona en avión, en el metro o sin datos.";
}
