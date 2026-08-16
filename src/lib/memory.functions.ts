import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AI_MODEL_ID = "google/gemini-3-pro-image";
export const AI_MODEL_LABEL = "Gemini 3 Pro (multimodal — texto + imagen)";
export const AI_DIFFERENTIATOR = "Memoria Emocional Persistente 💕";

export type UserMemory = {
  user_id: string;
  mood: string | null;
  mood_updated: string | null;
  likes: string[];
  dislikes: string[];
  goals: string[];
  important: string[];
  tone: string | null;
  summary: string;
  updated_at: string;
};

const EMPTY: Omit<UserMemory, "user_id" | "updated_at"> = {
  mood: null,
  mood_updated: null,
  likes: [],
  dislikes: [],
  goals: [],
  important: [],
  tone: null,
  summary: "",
};

export const getMyMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserMemory> => {
    const { data, error } = await context.supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as UserMemory;
    return {
      user_id: context.userId,
      ...EMPTY,
      updated_at: new Date().toISOString(),
    };
  });

export const updateMyMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      mood?: string | null;
      likes?: string[];
      dislikes?: string[];
      goals?: string[];
      important?: string[];
      tone?: string | null;
      summary?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      user_id: context.userId,
    };
    if (data.mood !== undefined) {
      patch.mood = data.mood;
      patch.mood_updated = new Date().toISOString();
    }
    if (data.likes !== undefined) patch.likes = data.likes.slice(0, 40);
    if (data.dislikes !== undefined) patch.dislikes = data.dislikes.slice(0, 40);
    if (data.goals !== undefined) patch.goals = data.goals.slice(0, 40);
    if (data.important !== undefined) patch.important = data.important.slice(0, 60);
    if (data.tone !== undefined) patch.tone = data.tone;
    if (data.summary !== undefined) patch.summary = data.summary.slice(0, 1200);

    const { error } = await context.supabase
      .from("user_memory")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(patch as any, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });

export const forgetMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_memory")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// Config pública de la IA — usada por el Panel Admin para mostrar el modelo activo.
export const getAiConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    model: AI_MODEL_ID,
    label: AI_MODEL_LABEL,
    differentiator: AI_DIFFERENTIATOR,
    modality: "Texto + Imagen (unificado)",
  };
});
