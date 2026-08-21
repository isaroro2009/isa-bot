// Server-only helpers para "🚀 Mi Día con IsaBot".

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

export type GeneratedBlock = {
  title: string;
  kind: "task" | "break";
  minutes: number;
};

function fallbackBlocks(goal: string, minutes: number, energy: string): GeneratedBlock[] {
  const focusLen = energy === "low" ? 20 : energy === "high" ? 45 : 30;
  const breakLen = energy === "low" ? 10 : 5;
  const blocks: GeneratedBlock[] = [];
  let left = Math.max(20, Math.min(minutes, 600));
  let i = 0;
  while (left >= focusLen) {
    blocks.push({
      title: i === 0 ? `🌟 ${goal.slice(0, 80)}` : `Avanzar en: ${goal.slice(0, 70)}`,
      kind: "task",
      minutes: focusLen,
    });
    left -= focusLen;
    if (left >= breakLen + focusLen) {
      blocks.push({ title: "☕ Descanso real (levántate, agua, estírate)", kind: "break", minutes: breakLen });
      left -= breakLen;
    }
    i += 1;
    if (blocks.length >= 10) break;
  }
  if (blocks.length === 0) {
    blocks.push({ title: `🌟 ${goal.slice(0, 80)}`, kind: "task", minutes: Math.max(15, minutes) });
  }
  return blocks;
}

export async function generatePlanBlocks(opts: {
  goal: string;
  energy: "low" | "normal" | "high";
  minutes: number;
  context: string;
}): Promise<{ blocks: GeneratedBlock[]; note: string }> {
  const key = process.env.GROQ_API_KEY;
  const fb = { blocks: fallbackBlocks(opts.goal, opts.minutes, opts.energy), note: "" };
  if (!key) return fb;

  const energyText =
    opts.energy === "low"
      ? "está con muy poca energía hoy — bloques cortos, más descansos, cero regaños"
      : opts.energy === "high"
        ? "está con mucha energía — puede con bloques largos de foco profundo"
        : "tiene energía normal";

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.5,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Eres IsaBot, copiloto de productividad. Devuelves SOLO un JSON válido, sin markdown ni explicación, con esta forma exacta:\n" +
              '{"note":"una frase cálida y honesta en español (máx 160 caracteres)","blocks":[{"title":"...","kind":"task"|"break","minutes":25}]}\n' +
              "Reglas: el primer bloque SIEMPRE ataca la meta principal. Máximo 8 bloques. La suma de minutos no puede pasar los minutos disponibles. Incluye descansos reales entre bloques de trabajo. Títulos concretos y accionables en español, con un emoji al inicio.",
          },
          {
            role: "user",
            content: `Meta principal de hoy: ${opts.goal}\nMinutos disponibles: ${opts.minutes}\nEnergía: la persona ${energyText}.\n${opts.context}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[dailyPlan] groq failed [${res.status}]: ${await res.text()}`);
      return fb;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fb;
    const parsed = JSON.parse(match[0]) as { note?: string; blocks?: GeneratedBlock[] };
    const blocks = (parsed.blocks ?? [])
      .filter((b) => b && typeof b.title === "string" && b.title.trim())
      .slice(0, 8)
      .map((b) => ({
        title: b.title.trim().slice(0, 120),
        kind: b.kind === "break" ? ("break" as const) : ("task" as const),
        minutes: Math.max(5, Math.min(120, Math.round(Number(b.minutes) || 25))),
      }));
    if (blocks.length === 0) return fb;
    return { blocks, note: (parsed.note ?? "").toString().slice(0, 200) };
  } catch (e) {
    console.error("[dailyPlan] generation error", e);
    return fb;
  }
}

export async function generateRecap(opts: {
  goal: string;
  done: string[];
  pending: string[];
  focusMinutes: number;
  streak: number;
}): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  const base =
    opts.done.length > 0
      ? `Cerraste ${opts.done.length} bloque(s) y ${opts.focusMinutes} minutos de foco. Racha: ${opts.streak} día(s). 💜`
      : `Hoy no cerraste bloques, y está bien. Mañana volvemos con uno solo, pequeño. 💜`;
  if (!key) return base;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Eres IsaBot. Escribe el cierre del día de una persona en español: máximo 60 palabras, cálida pero honesta, sin exagerar ni inventar logros. Si hizo poco, dilo con cariño y propone algo pequeño para mañana. Sin markdown.",
          },
          {
            role: "user",
            content: `Meta: ${opts.goal}\nCompletado: ${opts.done.join("; ") || "nada"}\nPendiente: ${opts.pending.join("; ") || "nada"}\nMinutos de foco: ${opts.focusMinutes}\nRacha: ${opts.streak}`,
          },
        ],
      }),
    });
    if (!res.ok) return base;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? base).trim() || base;
  } catch {
    return base;
  }
}
