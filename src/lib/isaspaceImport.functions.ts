import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportedPost = {
  id: string;
  source: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  content: string;
  image_url: string | null;
  url: string;
  published_at: string;
};

/** Publicaciones públicas traídas de una red social real (Mastodon / fediverso). */
export const listImported = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportedPost[]> => {
    const { data, error } = await context.supabase
      .from("isaspace_imported")
      .select("id, source, author_name, author_handle, author_avatar, content, image_url, url, published_at")
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return (data ?? []) as ImportedPost[];
  });

const TAGS = ["design", "art", "ai", "illustration", "creativity", "studygram"];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Importa publicaciones públicas reales del fediverso (mastodon.social).
 * Solo administradoras pueden ejecutarlo. No requiere API key ni OAuth.
 */
export const importSocialFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo administradoras pueden importar contenido.");

    type Status = {
      id: string;
      url: string;
      content: string;
      created_at: string;
      sensitive?: boolean;
      account: { display_name: string; acct: string; avatar_static?: string; avatar?: string };
      media_attachments?: { type: string; preview_url?: string; url?: string }[];
    };

    const rows: Record<string, unknown>[] = [];
    for (const tag of TAGS) {
      try {
        const res = await fetch(
          `https://mastodon.social/api/v1/timelines/tag/${tag}?limit=20&only_media=false`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) continue;
        const statuses = (await res.json()) as Status[];
        for (const s of statuses) {
          if (s.sensitive) continue;
          const text = stripHtml(s.content ?? "");
          if (text.length < 20) continue;
          const media = (s.media_attachments ?? []).find((m) => m.type === "image");
          rows.push({
            source: "mastodon",
            external_id: s.id,
            author_name: s.account.display_name || s.account.acct,
            author_handle: `@${s.account.acct}`,
            author_avatar: s.account.avatar_static ?? s.account.avatar ?? null,
            content: text.slice(0, 1200),
            image_url: media?.preview_url ?? media?.url ?? null,
            url: s.url,
            published_at: s.created_at,
          });
        }
      } catch {
        /* seguimos con el siguiente tag */
      }
    }

    if (rows.length === 0) return { ok: false as const, imported: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("isaspace_imported")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(rows as any, { onConflict: "source,external_id", ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true as const, imported: rows.length };
  });
