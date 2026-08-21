// Ingesta de Noticias Tech del Día.
// Fuentes públicas y gratuitas: Hacker News API + feeds RSS de medios tech.
// Se usa tanto desde el hook de cron como desde el refresco perezoso del panel.

export type RawItem = {
  title: string;
  url: string;
  source: string;
  published_at: string;
};

export type TopicKey = "ia" | "startups" | "dev" | "gadgets" | "general";

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
  { url: "https://arstechnica.com/feed/", source: "Ars Technica" },
  { url: "https://www.xataka.com/tag/feeds/rss2.xml", source: "Xataka" },
];

const TOPIC_RULES: Array<{ topic: TopicKey; words: string[] }> = [
  {
    topic: "ia",
    words: [
      "ai", "a.i.", "artificial intelligence", "inteligencia artificial", "llm", "gpt",
      "openai", "anthropic", "gemini", "machine learning", "modelo", "chatbot", "agent",
    ],
  },
  {
    topic: "startups",
    words: [
      "startup", "funding", "raises", "series a", "series b", "seed", "venture", "vc",
      "ipo", "acquisition", "adquisición", "ronda", "inversión", "unicorn", "y combinator",
    ],
  },
  {
    topic: "dev",
    words: [
      "developer", "open source", "github", "javascript", "typescript", "python", "rust",
      "framework", "api", "database", "kubernetes", "linux", "código", "programación", "release",
    ],
  },
  {
    topic: "gadgets",
    words: [
      "iphone", "android", "samsung", "pixel", "laptop", "chip", "gpu", "nvidia", "apple",
      "wearable", "smartwatch", "console", "review", "gadget", "auriculares", "cámara",
    ],
  },
];

export function classifyTopic(title: string): TopicKey {
  const t = title.toLowerCase();
  for (const rule of TOPIC_RULES) {
    if (rule.words.some((w) => t.includes(w))) return rule.topic;
  }
  return "general";
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHackerNews(limit = 15): Promise<RawItem[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const ids = ((await res.json()) as number[]).slice(0, limit);
    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
            signal: AbortSignal.timeout(6000),
          });
          if (!r.ok) return null;
          const it = (await r.json()) as {
            title?: string;
            url?: string;
            time?: number;
            type?: string;
          };
          if (!it?.title || it.type !== "story") return null;
          return {
            title: decodeEntities(it.title).slice(0, 260),
            url: it.url ?? `https://news.ycombinator.com/item?id=${id}`,
            source: "Hacker News",
            published_at: new Date((it.time ?? Date.now() / 1000) * 1000).toISOString(),
          } satisfies RawItem;
        } catch {
          return null;
        }
      }),
    );
    return items.filter((i): i is RawItem => i !== null);
  } catch {
    return [];
  }
}

function parseRss(xml: string, source: string, limit = 8): RawItem[] {
  const out: RawItem[] = [];
  const blocks = xml.split(/<(?:item|entry)[\s>]/i).slice(1);
  for (const block of blocks.slice(0, limit)) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    let link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1];
    if (!link || !link.trim()) link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const date =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1];
    if (!title || !link) continue;
    const cleanTitle = decodeEntities(title).slice(0, 260);
    const cleanLink = decodeEntities(link);
    if (!cleanTitle || !/^https?:\/\//.test(cleanLink)) continue;
    const parsed = date ? new Date(decodeEntities(date)) : null;
    out.push({
      title: cleanTitle,
      url: cleanLink,
      source,
      published_at:
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString(),
    });
  }
  return out;
}

async function fetchFeeds(): Promise<RawItem[]> {
  const results = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          headers: { "User-Agent": "IsaBot/1.0 (news reader)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return [];
        return parseRss(await r.text(), feed.source);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export async function collectNews(): Promise<Array<RawItem & { topic: TopicKey }>> {
  const [hn, rss] = await Promise.all([fetchHackerNews(), fetchFeeds()]);
  const seen = new Set<string>();
  const all: Array<RawItem & { topic: TopicKey }> = [];
  for (const item of [...rss, ...hn]) {
    const key = item.url.replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push({ ...item, topic: classifyTopic(item.title) });
  }
  return all
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
    .slice(0, 60);
}

/** POST a Groq con reintentos suaves cuando hay 429/413 (límites de tokens). */
async function groqChat(body: unknown, label: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429 || res.status === 413 || res.status >= 500) {
        console.error(`[tech-news] ${label} retry ${attempt + 1} [${res.status}]`);
        if (attempt === 2) return "";
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        console.error(`[tech-news] ${label} failed [${res.status}]`);
        return "";
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return json.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      console.error(`[tech-news] ${label} error`, e);
      if (attempt === 2) return "";
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return "";
}

export async function aiDigest(titles: string[]): Promise<string> {
  if (titles.length === 0) return "";
  return groqChat(
    {
      model: "openai/gpt-oss-20b",
      temperature: 0.5,
      max_tokens: 260,
      messages: [
        {
          role: "system",
          content:
            "Eres IsaBot. Resume en español, en 3 o 4 frases cálidas y concretas, lo más importante del día en tecnología a partir de los titulares que te den. Di qué tema dominó la jornada y por qué importa para alguien creativo o emprendedor. Sin listas, sin markdown, máximo 2 emojis.",
        },
        { role: "user", content: titles.slice(0, 15).join("\n") },
      ],
    },
    "digest",
  );
}

/** Traduce los titulares al español y escribe un resumen corto de IsaBot para cada uno. */
export async function aiTranslateItems(
  items: Array<{ title: string; source: string }>,
): Promise<Array<{ title_es: string; summary: string }>> {
  const fallback = items.map((i) => ({ title_es: i.title, summary: "" }));
  if (items.length === 0) return fallback;
  const raw = await groqChat(
    {
      model: "openai/gpt-oss-20b",
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Eres IsaBot. Recibes titulares de tecnología (a veces en inglés). Devuelve SOLO un JSON con la forma {"items":[{"i":0,"titulo":"...","resumen":"..."}]}. "titulo" es el titular traducido y natural en español (máx. 110 caracteres). "resumen" son 1 o 2 frases en español, cálidas y claras, explicando de qué va y por qué importa (máx. 220 caracteres, sin markdown, máximo 1 emoji). Un objeto por cada titular, respetando el índice "i".',
        },
        {
          role: "user",
          content: items.map((it, i) => `${i}. ${it.title.slice(0, 160)}`).join("\n"),
        },
      ],
    },
    "translate",
  );
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as {
      items?: Array<{ i?: number; titulo?: string; resumen?: string }>;
    };
    const out = [...fallback];
    for (const entry of parsed.items ?? []) {
      const idx = typeof entry.i === "number" ? entry.i : -1;
      if (idx < 0 || idx >= out.length) continue;
      out[idx] = {
        title_es: (entry.titulo ?? out[idx].title_es).slice(0, 260),
        summary: (entry.resumen ?? "").slice(0, 400),
      };
    }
    return out;
  } catch {
    return fallback;
  }
}

let lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 20 * 60 * 1000;

/** Trae noticias frescas, las guarda y regenera el resumen del día. */
export async function refreshTechNews(): Promise<{ inserted: number; total: number }> {
  if (Date.now() - lastRefreshAt < REFRESH_COOLDOWN_MS) return { inserted: 0, total: 0 };
  lastRefreshAt = Date.now();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;

  const items = (await collectNews()).slice(0, 24);
  if (items.length === 0) return { inserted: 0, total: 0 };

  // Solo traducimos lo que aún no está traducido en la base (ahorra tokens de Groq)
  const { data: known } = await admin
    .from("tech_news")
    .select("url, title_es, summary")
    .in("url", items.map((i) => i.url));
  const cache = new Map<string, { title_es: string | null; summary: string | null }>(
    ((known ?? []) as Array<{ url: string; title_es: string | null; summary: string | null }>).map(
      (r) => [r.url, { title_es: r.title_es, summary: r.summary }],
    ),
  );

  const pending = items.filter((i) => !cache.get(i.url)?.title_es);
  const translated = new Map<string, { title_es: string; summary: string }>();

  // Lotes pequeños y espaciados para respetar el límite de tokens por minuto
  for (let i = 0; i < pending.length; i += 6) {
    const chunk = pending.slice(i, i + 6);
    const res = await aiTranslateItems(chunk);
    chunk.forEach((item, idx) => {
      const t = res[idx];
      if (t) translated.set(item.url, t);
    });
    if (i + 6 < pending.length) await new Promise((r) => setTimeout(r, 3000));
  }

  const rows = items.map((i) => {
    const cached = cache.get(i.url);
    const fresh = translated.get(i.url);
    return {
      title: i.title,
      title_es: fresh?.title_es || cached?.title_es || i.title,
      summary: fresh?.summary || cached?.summary || null,
      url: i.url,
      source: i.source,
      topic: i.topic,
      published_at: i.published_at,
      fetched_at: new Date().toISOString(),
    };
  });

  const { error } = await admin.from("tech_news").upsert(rows, { onConflict: "url" });
  if (error) console.error("[tech-news] upsert error", error.message);

  // Resumen del día (solo si aún no existe para hoy)
  const today = new Date().toISOString().slice(0, 10);
  const { data: existingDigest } = await admin
    .from("tech_news_digest")
    .select("summary")
    .eq("day", today)
    .maybeSingle();
  if (!existingDigest?.summary) {
    const summary = await aiDigest(items.slice(0, 12).map((i) => `- ${i.title.slice(0, 140)}`));
    if (summary) {
      await admin
        .from("tech_news_digest")
        .upsert(
          { day: today, summary, updated_at: new Date().toISOString() },
          { onConflict: "day" },
        );
    }
  }


  // Limpieza: nos quedamos con lo de los últimos 5 días
  await admin
    .from("tech_news")
    .delete()
    .lt("published_at", new Date(Date.now() - 5 * 86400000).toISOString());

  return { inserted: rows.length, total: items.length };
}
