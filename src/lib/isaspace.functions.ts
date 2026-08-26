import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IsaPostType = "project" | "progress" | "collab";

export type IsaPost = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  post_type: IsaPostType;
  author_name: string;
  author_avatar: string | null;
  author_skills: string[];
  author_headline: string | null;
  likes: number;
  liked_by_me: boolean;
  comments: { id: string; user_id: string; content: string; created_at: string; author_name: string }[];
};

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IsaPost[]> => {
    const { supabase, userId } = context;
    const { data: posts, error } = await supabase
      .from("isaspace_posts")
      .select("id, user_id, content, image_url, created_at, post_type")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    const rows = posts ?? [];
    if (rows.length === 0) return [];

    const ids = rows.map((p) => p.id);
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from("isaspace_likes").select("post_id, user_id").in("post_id", ids),
      supabase
        .from("isaspace_comments")
        .select("id, post_id, user_id, content, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: true }),
    ]);

    const authorIds = new Set<string>();
    for (const p of rows) authorIds.add(p.user_id);
    for (const c of comments ?? []) authorIds.add(c.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, headline, interests")
      .in("id", Array.from(authorIds));
    const nameOf = new Map<
      string,
      { name: string; avatar: string | null; skills: string[]; headline: string | null }
    >();
    for (const p of profs ?? []) {
      nameOf.set(p.id, {
        name: p.display_name || (p.email ?? "").split("@")[0] || "Anónima",
        avatar: p.avatar_url,
        skills: ((p.interests ?? []) as string[]).slice(0, 3),
        headline: p.headline ?? null,
      });
    }

    // Firmar rutas de imágenes guardadas en el bucket privado "isaspace"
    const paths = rows.map((p) => p.image_url).filter((u): u is string => !!u && !u.startsWith("http"));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: urls } = await supabase.storage.from("isaspace").createSignedUrls(paths, 60 * 60 * 24 * 7);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    return rows.map((p) => {
      const postLikes = (likes ?? []).filter((l) => l.post_id === p.id);
      return {
        ...p,
        image_url: p.image_url ? (signed.get(p.image_url) ?? (p.image_url.startsWith("http") ? p.image_url : null)) : null,
        post_type: ((p as { post_type?: string }).post_type ?? "project") as IsaPostType,
        author_name: nameOf.get(p.user_id)?.name ?? "Anónima",
        author_avatar: nameOf.get(p.user_id)?.avatar ?? null,
        author_skills: nameOf.get(p.user_id)?.skills ?? [],
        author_headline: nameOf.get(p.user_id)?.headline ?? null,
        likes: postLikes.length,
        liked_by_me: postLikes.some((l) => l.user_id === userId),
        comments: (comments ?? [])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            id: c.id,
            user_id: c.user_id,
            content: c.content,
            created_at: c.created_at,
            author_name: nameOf.get(c.user_id)?.name ?? "Anónima",
          })),
      };
    });
  });

async function rewardIsaspace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  kind: "post" | "feedback",
): Promise<number> {
  const { data } = await supabase.rpc("ibc_reward_isaspace", { _kind: kind });
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.delta as number | undefined) ?? 0;
}

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string; imageUrl?: string | null; postType?: IsaPostType }) => input)
  .handler(async ({ data, context }) => {
    const content = (data.content ?? "").trim().slice(0, 2000);
    if (!content) throw new Error("Escribe algo antes de publicar 💕");
    const postType: IsaPostType =
      data.postType === "progress" || data.postType === "collab" ? data.postType : "project";
    const { error } = await context.supabase.from("isaspace_posts").insert({
      user_id: context.userId,
      content,
      image_url: data.imageUrl ?? null,
      post_type: postType,
    });
    if (error) throw error;
    const reward = await rewardIsaspace(context.supabase, "post");
    return { ok: true, reward };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("isaspace_posts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; liked: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.liked) {
      const { error } = await context.supabase
        .from("isaspace_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("isaspace_likes")
        .insert({ post_id: data.postId, user_id: context.userId });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
    }
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; content: string }) => input)
  .handler(async ({ data, context }) => {
    const content = (data.content ?? "").trim().slice(0, 800);
    if (!content) return { ok: false };
    const { error } = await context.supabase.from("isaspace_comments").insert({
      post_id: data.postId,
      user_id: context.userId,
      content,
    });
    if (error) throw error;
    return { ok: true };
  });

// ── "Quiénes somos": tarjetas de presentación de la comunidad
export type IsaMember = {
  id: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  interests: string[];
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IsaMember[]> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, headline, bio, location, interests")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return (data ?? [])
      .filter((p) => (p.bio && p.bio.trim()) || (p.headline && p.headline.trim()))
      .map((p) => ({
        id: p.id,
        name: p.display_name || (p.email ?? "").split("@")[0] || "Anónima",
        avatar_url: p.avatar_url,
        headline: p.headline,
        bio: p.bio,
        location: p.location,
        interests: (p.interests ?? []) as string[],
      }));
  });
