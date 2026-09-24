import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmotionalRow = {
  id: string;
  user_id: string;
  mood: string;
  message: string | null;
  created_at: string;
  author_name: string | null;
  author_email: string | null;
};

export const submitEmotional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { mood: string; message?: string }) =>
    z.object({
      mood: z.enum(["feliz", "bien", "normal", "confundida", "frustrada"]),
      message: z.string().trim().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("emotional_feedback").insert({
      user_id: context.userId,
      mood: data.mood,
      message: data.message || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const lastEmotional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("emotional_feedback")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { last: data?.created_at ?? null };
  });

export const listEmotional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmotionalRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("emotional_feedback")
      .select("id, user_id, mood, message, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((r) => r.user_id))];
    const names = new Map<string, { display_name: string | null; email: string | null }>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name, email").in("id", ids);
      for (const p of profs ?? []) names.set(p.id, p);
    }
    return (data ?? []).map((r) => ({
      ...r,
      author_name: names.get(r.user_id)?.display_name ?? null,
      author_email: names.get(r.user_id)?.email ?? null,
    }));
  });

export const sendLiveNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { title: string; body: string }) =>
    z.object({ title: z.string().trim().min(2).max(80), body: z.string().trim().min(2).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("in_app_notifications")
      .insert({ title: data.title, body: data.body, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
