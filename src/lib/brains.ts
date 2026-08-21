// 🧠 Catálogo único de cerebros de IsaBot.
// Hacia afuera todo se llama con nombres propios de IsaRoRo Studio.
// Provider "groq" = motor propio 24/7 · "lovable" = gateway de IA de Lovable.

export type BrainProvider = "groq" | "lovable" | "openrouter" | "local";

export type BrainDef = {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  premium: boolean;
  provider: BrainProvider;
  engine: string;
  vendor: string;
  use: string;
};

export const BRAINS: BrainDef[] = [
  {
    id: "isa-v1",
    name: "IsaBot-model-AI v1",
    emoji: "💜",
    hint: "Equilibrado, el de siempre",
    premium: false,
    provider: "groq",
    engine: "openai/gpt-oss-120b",
    vendor: "Meta Llama 3.3 70B (vía Groq)",
    use: "Chat general equilibrado, el motor por defecto",
  },
  {
    id: "isa-flash",
    name: "IsaBot Flash",
    emoji: "⚡",
    hint: "Respuestas al instante",
    premium: false,
    provider: "groq",
    engine: "openai/gpt-oss-20b",
    vendor: "Meta Llama 3.1 8B (vía Groq)",
    use: "Respuestas instantáneas y respaldo si hay saturación",
  },
  {
    id: "isa-pro",
    name: "IsaBot Pro",
    emoji: "🧠",
    hint: "Razonamiento profundo y código",
    premium: true,
    provider: "groq",
    engine: "openai/gpt-oss-120b",
    vendor: "OpenAI GPT-OSS 120B (vía Groq)",
    use: "Razonamiento profundo, código y análisis largo",
  },
  {
    id: "isa-creativa",
    name: "IsaBot Live",
    emoji: "🌐",
    hint: "Busca en la web en vivo",
    premium: true,
    provider: "groq",
    engine: "groq/compound",
    vendor: "Groq Compound (con búsqueda web)",
    use: "Preguntas de actualidad con búsqueda en vivo",
  },
  {
    id: "isa-spark",
    name: "IsaBot Gemini Spark",
    emoji: "✨",
    hint: "Chispa rápida con toque creativo",
    premium: false,
    provider: "lovable",
    engine: "google/gemini-3.6-flash",
    vendor: "Gemini 3.6 Flash (vía Lovable AI)",
    use: "Ideas rápidas, chat ágil y creatividad del día a día",
  },
  {
    id: "isa-genius",
    name: "IsaBot Genius",
    emoji: "🧬",
    hint: "Contexto enorme y razonamiento fino",
    premium: true,
    provider: "lovable",
    engine: "google/gemini-3.1-pro-preview",
    vendor: "Gemini 3.1 Pro (vía Lovable AI)",
    use: "Textos largos, investigación y análisis complejo",
  },
  {
    id: "isa-maximo",
    name: "IsaBot Máximo",
    emoji: "🎯",
    hint: "Lo más fuerte para código y análisis",
    premium: true,
    provider: "lovable",
    engine: "openai/gpt-5.5",
    vendor: "GPT-5.5 (vía Lovable AI)",
    use: "Código difícil, estrategia y trabajo profesional",
  },
  {
    id: "isa-claude",
    name: "IsaBot Claude",
    emoji: "🎼",
    hint: "Escritura fina y razonamiento preciso",
    premium: true,
    provider: "openrouter",
    engine: "anthropic/claude-3.5-sonnet",
    vendor: "Claude 3.5 Sonnet (vía OpenRouter)",
    use: "Escritura cuidada, análisis largo y respuestas muy precisas",
  },
  {
    id: "isa-claude-flash",
    name: "IsaBot Claude Flash",
    emoji: "🪶",
    hint: "Claude rápido y económico",
    premium: true,
    provider: "openrouter",
    engine: "anthropic/claude-3-haiku",
    vendor: "Claude 3 Haiku (vía OpenRouter)",
    use: "Respuestas rápidas con la precisión de Claude",
  },
  {
    id: "isa-local",
    name: "IsaBot Local",
    emoji: "📴",
    hint: "Funciona sin internet, en tu dispositivo",
    premium: false,
    provider: "local",
    engine: "Qwen2.5-0.5B-Instruct (WebLLM)",
    vendor: "En el dispositivo (sin servidor)",
    use: "Chatear sin WiFi ni datos: respuestas cortas y 100% privadas",
  },
];


export const BRAIN_BY_ID: Record<string, BrainDef> = Object.fromEntries(
  BRAINS.map((b) => [b.id, b]),
);

export const DEFAULT_BRAIN = BRAINS[0]!;

/** Devuelve el cerebro efectivo respetando el plan de la persona. */
export function resolveBrainDef(id: unknown, isPremium: boolean): BrainDef {
  const b = typeof id === "string" ? BRAIN_BY_ID[id] : undefined;
  if (!b) return DEFAULT_BRAIN;
  if (b.premium && !isPremium) return DEFAULT_BRAIN;
  return b;
}

export type Need = "code" | "live" | "deep" | "fast" | "general";

/** Detecta qué necesita la persona a partir de su mensaje. */
export function detectNeed(text: string): Need {
  const t = (text || "").toLowerCase();
  if (
    /\b(c[óo]digo|codigo|programa|programar|script|funci[óo]n|component|react|python|javascript|typescript|sql|css|html|api|bug|error de c[óo]digo|debug|regex|algoritmo|clase|compil)/.test(t)
  )
    return "code";
  if (
    /\b(noticia|noticias|hoy|ahora mismo|actualidad|precio|cotizaci[óo]n|d[óo]lar|clima|tiempo en|resultado|[úu]ltimas|reciente|202[6-9])/.test(t)
  )
    return "live";
  if (
    /\b(analiza|an[áa]lisis|ensayo|estrategia|plan de negocio|informe|investiga|compara a fondo|resumen largo|tesis|propuesta detallada)/.test(t) ||
    t.length > 700
  )
    return "deep";
  if (t.length <= 25) return "fast";
  return "general";
}

/**
 * Elige el cerebro automáticamente según la necesidad del mensaje.
 * Si la persona eligió un cerebro distinto al de siempre, se respeta su elección.
 */
export function autoBrainFor(text: string, chosenId: unknown, isPremium: boolean): BrainDef {
  const chosen = typeof chosenId === "string" ? BRAIN_BY_ID[chosenId] : undefined;
  const isAuto = !chosen || chosen.id === DEFAULT_BRAIN.id || chosenId === "auto";
  if (!isAuto) return resolveBrainDef(chosenId, isPremium);

  const need = detectNeed(text);
  const pick =
    need === "code"
      ? "isa-pro"
      : need === "live"
        ? "isa-creativa"
        : need === "deep"
          ? "isa-genius"
          : need === "fast"
            ? "isa-flash"
            : DEFAULT_BRAIN.id;
  return resolveBrainDef(pick, isPremium);
}

