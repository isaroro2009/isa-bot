import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BotWeeklyReport = {
  from: string;
  to: string;
  totals: {
    messages: number;
    users: number;
    images: number;
    voiceMessages: number;
    crackMode: number;
    withIsaspaceContext: number;
    avgReplyLen: number;
  };
  risk: {
    uncertaintyRate: number;
    overclaimRate: number;
    freshnessClaimRate: number;
    linkRate: number;
    emptyReplyRate: number;
    hallucinationRisk: number;
    level: "bajo" | "medio" | "alto";
  };
  prevWeek: { messages: number; hallucinationRisk: number };
  topTopics: { topic: string; count: number }[];
  byPersonality: { name: string; count: number; overclaimRate: number }[];
  summary: string;
};

type EventRow = {
  event_type: string;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function analyze(rows: EventRow[]) {
  const msgs = rows.filter((r) => r.event_type === "message_sent");
  const total = msgs.length;
  let uncertainty = 0,
    overclaim = 0,
    freshness = 0,
    links = 0,
    empty = 0,
    lenSum = 0,
    voice = 0,
    crack = 0,
    isaspace = 0;
  const users = new Set<string>();
  const topics = new Map<string, number>();
  const persona = new Map<string, { count: number; overclaim: number }>();

  for (const m of msgs) {
    const md = (m.metadata ?? {}) as Record<string, unknown>;
    if (m.user_id) users.add(m.user_id);
    const len = typeof md.replyLen === "number" ? md.replyLen : 0;
    lenSum += len;
    if (len === 0) empty += 1;
    if (md.uncertainty === true) uncertainty += 1;
    if (md.overclaim === true) overclaim += 1;
    if (md.freshnessClaim === true) freshness += 1;
    if (md.hasLink === true) links += 1;
    if (md.voiceMode === true) voice += 1;
    if (md.crackMode === true) crack += 1;
    if (md.usedIsaspace === true) isaspace += 1;
    const t = typeof md.topic === "string" ? md.topic : "💬 General";
    topics.set(t, (topics.get(t) ?? 0) + 1);
    const p = typeof md.personalidad === "string" ? md.personalidad : "kawaii";
    const entry = persona.get(p) ?? { count: 0, overclaim: 0 };
    entry.count += 1;
    if (md.overclaim === true) entry.overclaim += 1;
    persona.set(p, entry);
  }

  const overclaimRate = pct(overclaim, total);
  const freshnessClaimRate = pct(freshness, total);
  const uncertaintyRate = pct(uncertainty, total);
  // Riesgo: afirmar con seguridad absoluta o hablar de "ahora mismo" sin matices,
  // compensado por la honestidad de admitir dudas.
  const hallucinationRisk = Math.max(
    0,
    Math.min(100, Math.round(overclaimRate * 1.2 + freshnessClaimRate * 0.6 - uncertaintyRate * 0.4)),
  );

  return {
    total,
    users: users.size,
    images: rows.filter((r) => r.event_type === "image_generated").length,
    voice,
    crack,
    isaspace,
    avgReplyLen: total ? Math.round(lenSum / total) : 0,
    uncertaintyRate,
    overclaimRate,
    freshnessClaimRate,
    linkRate: pct(links, total),
    emptyReplyRate: pct(empty, total),
    hallucinationRisk,
    topTopics: Array.from(topics, ([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    byPersonality: Array.from(persona, ([name, v]) => ({
      name,
      count: v.count,
      overclaimRate: pct(v.overclaim, v.count),
    })).sort((a, b) => b.count - a.count),
  };
}

async function narrate(payload: unknown): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "Eres analista de calidad de un asistente de IA llamado IsaBot. A partir de métricas agregadas de la última semana, escribe un informe breve en español (máx. 180 palabras) para la fundadora: 1) cómo se comportó IsaBot, 2) señales de posible alucinación o exceso de seguridad, 3) 2-3 recomendaciones concretas. Sé honesto, directo y sin adornos. No inventes datos que no estén en las métricas.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

export const getBotWeeklyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BotWeeklyReport> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("No se pudo verificar el rol");
    if (!isAdmin) throw new Error("Forbidden: se requiere rol admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const from = new Date(now - 7 * 86400_000);
    const prevFrom = new Date(now - 14 * 86400_000);

    const { data: rows } = await supabaseAdmin
      .from("analytics_events")
      .select("event_type, user_id, created_at, metadata")
      .gte("created_at", prevFrom.toISOString())
      .limit(20000);

    const all = (rows ?? []) as EventRow[];
    const week = all.filter((r) => new Date(r.created_at).getTime() >= from.getTime());
    const prev = all.filter((r) => new Date(r.created_at).getTime() < from.getTime());

    const a = analyze(week);
    const p = analyze(prev);

    const level: BotWeeklyReport["risk"]["level"] =
      a.hallucinationRisk >= 45 ? "alto" : a.hallucinationRisk >= 20 ? "medio" : "bajo";

    const base: Omit<BotWeeklyReport, "summary"> = {
      from: from.toISOString().slice(0, 10),
      to: new Date(now).toISOString().slice(0, 10),
      totals: {
        messages: a.total,
        users: a.users,
        images: a.images,
        voiceMessages: a.voice,
        crackMode: a.crack,
        withIsaspaceContext: a.isaspace,
        avgReplyLen: a.avgReplyLen,
      },
      risk: {
        uncertaintyRate: a.uncertaintyRate,
        overclaimRate: a.overclaimRate,
        freshnessClaimRate: a.freshnessClaimRate,
        linkRate: a.linkRate,
        emptyReplyRate: a.emptyReplyRate,
        hallucinationRisk: a.hallucinationRisk,
        level,
      },
      prevWeek: { messages: p.total, hallucinationRisk: p.hallucinationRisk },
      topTopics: a.topTopics,
      byPersonality: a.byPersonality,
    };

    const summary = a.total > 0 ? await narrate(base) : "";
    return { ...base, summary };
  });
