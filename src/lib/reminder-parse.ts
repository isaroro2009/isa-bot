/** Detección de intenciones de recordatorio en el chat (cliente, sin IA). */

export type ParsedReminder = {
  kind: "habit" | "task";
  title: string;
  frequency: "daily" | "weekly" | "once";
  send_hour: number;
  send_minute: number;
  weekday: number | null;
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

const TRIGGERS = [
  /recu[ée]rdame\s+(.+)/i,
  /rec[uo]erdame\s+(.+)/i,
  /quiero (?:crear|empezar|cumplir|tener) (?:el |un |la )?h[áa]bito(?: de)?\s+(.+)/i,
  /mi nuevo h[áa]bito (?:es|ser[áa])\s+(.+)/i,
  /(?:agr[eé]game|ponme|m[áa]ndame) un recordatorio (?:de|para)?\s*(.+)/i,
  /no me dejes olvidar\s+(.+)/i,
];

function cleanTitle(raw: string): string {
  return raw
    .replace(/\b(?:a las|a la)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|hs|horas)?/gi, "")
    .replace(/\b(?:todos los d[íi]as|cada d[íi]a|diariamente|cada semana|todas las semanas)\b/gi, "")
    .replace(/\b(?:los|el|cada)\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)s?\b/gi, "")
    .replace(/\bpor (?:correo|email|mail)\b/gi, "")
    .replace(/[.,;!¡?¿]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseReminder(text: string): ParsedReminder | null {
  const lower = text.toLowerCase();
  let body: string | null = null;
  for (const re of TRIGGERS) {
    const m = text.match(re);
    if (m?.[1]) { body = m[1]; break; }
  }
  if (!body) return null;

  const title = cleanTitle(body);
  if (title.length < 3 || title.length > 140) return null;

  // Hora: "a las 7", "a las 19:30", "a las 8 pm"
  let hour = 9;
  let minute = 0;
  const hm = lower.match(/a las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (hm) {
    hour = parseInt(hm[1], 10);
    minute = hm[2] ? parseInt(hm[2], 10) : 0;
    if (hm[3] === "pm" && hour < 12) hour += 12;
    if (hm[3] === "am" && hour === 12) hour = 0;
    if (hour > 23) hour = 9;
  }

  let frequency: ParsedReminder["frequency"] = "daily";
  let weekday: number | null = null;
  const wd = lower.match(/(?:los|el|cada)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)/);
  if (wd) {
    frequency = "weekly";
    weekday = WEEKDAYS[wd[1]] ?? 1;
  } else if (/\b(?:hoy|ma[ñn]ana)\b/.test(lower) && !/todos los d[íi]as|cada d[íi]a|diariamente/.test(lower)) {
    frequency = "once";
  }

  const isHabit = /h[áa]bito|rutina|racha|meditar|entrenar|leer|ejercicio|agua/.test(lower);

  return {
    kind: isHabit ? "habit" : "task",
    title,
    frequency,
    send_hour: hour,
    send_minute: minute,
    weekday,
  };
}

export function reminderSummary(r: ParsedReminder): string {
  const hh = `${String(r.send_hour).padStart(2, "0")}:${String(r.send_minute).padStart(2, "0")}`;
  const days = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  const when =
    r.frequency === "daily" ? "todos los días" :
    r.frequency === "weekly" ? `los ${days[r.weekday ?? 1]}` : "una sola vez";
  return `${r.kind === "habit" ? "🌱 Hábito" : "⏰ Tarea"} · **${r.title}** · ${when} a las ${hh}`;
}
