/** Detección de intención de "enviar correo" en el chat (cliente, sin IA). */

export type ParsedEmailIntent = {
  to: string;
  subject: string;
  body: string;
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

const TRIGGERS = [
  /(?:env[íi]a|manda|escribe|redacta)\s+(?:un\s+)?(?:correo|email|mail|mensaje por correo)/i,
];

export function parseEmailIntent(text: string): ParsedEmailIntent | null {
  if (!TRIGGERS.some((re) => re.test(text))) return null;
  const mail = text.match(EMAIL_RE);
  if (!mail) return null;
  const to = mail[0];

  let subject = "";
  const subj = text.match(/(?:asunto|tema)\s*[:=]?\s*["“]?([^"”\n.]{3,120})/i);
  if (subj?.[1]) subject = subj[1].trim();

  let body = "";
  const bodyMatch = text.match(/(?:que\s+diga|dici[ée]ndole|cuerpo|mensaje)\s*[:=]?\s*["“]?([\s\S]{3,1200})/i);
  if (bodyMatch?.[1]) body = bodyMatch[1].replace(/["”]\s*$/, "").trim();

  if (!body) {
    body = text
      .replace(EMAIL_RE, "")
      .replace(TRIGGERS[0], "")
      .replace(/^\s*(?:a|para|al)\s+/i, "")
      .trim();
  }
  if (!subject) subject = "Mensaje de parte de IsaBot 💕";
  if (body.length < 3) body = "Hola 💕";

  return { to, subject: subject.slice(0, 120), body: body.slice(0, 1200) };
}
