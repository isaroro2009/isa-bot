import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TechNewsItem = {
  id: string;
  title: string;
  title_es: string | null;
  summary: string | null;
  content: string | null;
  content_es: string | null;
  url: string;
  source: string;
  topic: string;
  published_at: string;
};

export type TechNewsPayload = {
  items: TechNewsItem[];
  digest: string;
  updatedAt: string | null;
};

const STALE_MS = 60 * 60 * 1000; // 1 hora

export const getTechNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TechNewsPayload> => {
    const { supabase } = context;

    async function read(): Promise<TechNewsPayload> {
      const { data, error } = await supabase
        .from("tech_news")
        .select("id, title, title_es, summary, content, content_es, url, source, topic, published_at, fetched_at")
        .order("published_at", { ascending: false })
        .limit(40);
      if (error) throw new Error(error.message);

      const items = (data ?? []) as Array<TechNewsItem & { fetched_at: string }>;
      const today = new Date().toISOString().slice(0, 10);
      const { data: dig } = await supabase
        .from("tech_news_digest")
        .select("summary")
        .eq("day", today)
        .maybeSingle();

      return {
        items: items.map(({ fetched_at: _f, ...rest }) => rest),
        digest: dig?.summary ?? "",
        updatedAt: items[0]?.fetched_at ?? null,
      };
    }

    let payload = await read();
    const stale =
      payload.items.length === 0 ||
      !payload.updatedAt ||
      payload.items.every((i) => !i.title_es) ||
      Date.now() - new Date(payload.updatedAt).getTime() > STALE_MS;

    if (stale) {
      try {
        const { refreshTechNews } = await import("@/lib/techNews.server");
        await refreshTechNews();
        payload = await read();
      } catch (e) {
        console.error("[tech-news] refresh failed", e);
      }
    }

    return payload;
  });
