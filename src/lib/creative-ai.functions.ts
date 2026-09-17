import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CourseInput = z.object({ topic: z.string().trim().min(5).max(500) });
const ThemeInput = z.object({ description: z.string().trim().min(3).max(160) });

type GatewayError = Error & { status?: number };

function extractGatewayMessage(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? fallback;
  } catch {
    return raw.trim() || fallback;
  }
}

async function streamResponse(prompt: string): Promise<string> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Lovable AI no está configurado en este momento.");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        store: false,
      }),
    });

    if (!response.ok) {
      const message = extractGatewayMessage(await response.text(), `Lovable AI respondió ${response.status}`);
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 1500;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      const error = new Error(message) as GatewayError;
      error.status = response.status;
      throw error;
    }

    if (!response.body) throw new Error("Lovable AI no devolvió contenido.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let reasoning = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as { type?: string; delta?: string };
            if (json.type === "response.output_text.delta") answer += json.delta ?? "";
            if (json.type === "response.reasoning_summary_text.delta") reasoning += json.delta ?? "";
          } catch {
            // Ignore partial or provider keep-alive events.
          }
        }
      }
    }
    const text = answer.trim() || reasoning.trim();
    if (!text) throw new Error("Lovable AI terminó sin generar contenido.");
    return text;
  }
  throw new Error("Lovable AI no está disponible ahora mismo.");
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(candidate) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("La generación no devolvió el formato esperado.");
  }
  return parsed as Record<string, unknown>;
}

const GeneratedCourse = z.object({
  title: z.string().min(1).max(100),
  emoji: z.string().min(1).max(8),
  body: z.array(z.string().min(1).max(900)).min(3).max(6),
  questions: z.array(z.object({
    q: z.string().min(1).max(220),
    options: z.array(z.string().min(1).max(160)).length(4),
    answer: z.number().int().min(0).max(3),
    explain: z.string().min(1).max(300),
  })).min(3).max(5),
});

export type GeneratedCourse = z.infer<typeof GeneratedCourse>;

export const generateCustomCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CourseInput.parse(input))
  .handler(async ({ data }): Promise<GeneratedCourse> => {
    const raw = await streamResponse(
      `Crea un módulo educativo breve y práctico en español sobre: "${data.topic}". ` +
      `Devuelve únicamente JSON válido con esta forma: ` +
      `{"title":"...","emoji":"...","body":["sección 1","sección 2","sección 3"],` +
      `"questions":[{"q":"...","options":["...","...","...","..."],"answer":0,"explain":"..."}]}. ` +
      `Incluye entre 3 y 5 preguntas, exactamente 4 opciones por pregunta y answer como índice 0-3. ` +
      `El contenido debe ser correcto, claro para principiantes y suficiente para responder el quiz.`,
    );
    return GeneratedCourse.parse(parseJsonObject(raw));
  });

const GeneratedTheme = z.object({
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export type GeneratedTheme = z.infer<typeof GeneratedTheme>;

export const generateCustomTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ThemeInput.parse(input))
  .handler(async ({ data }): Promise<GeneratedTheme> => {
    const raw = await streamResponse(
      `Diseña una paleta accesible para una interfaz de chat inspirada en: "${data.description}". ` +
      `Devuelve únicamente JSON válido: {"background":"#RRGGBB","text":"#RRGGBB","accent":"#RRGGBB"}. ` +
      `El texto debe contrastar claramente con el fondo; el acento debe distinguirse de ambos.`,
    );
    return GeneratedTheme.parse(parseJsonObject(raw));
  });