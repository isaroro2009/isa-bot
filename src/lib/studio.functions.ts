import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StudioKind = "design" | "paint" | "pixel" | "doc" | "slides" | "sheet";

export type StudioProject = {
  id: string;
  kind: StudioKind;
  title: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
};

export type StudioDoc = {
  project: StudioProject;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
};

const KINDS: StudioKind[] = ["design", "paint", "pixel", "doc", "slides", "sheet"];

export const listStudioProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("studio_projects")
      .select("id, kind, title, thumbnail, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: (data ?? []) as StudioProject[] };
  });

export const createStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; title?: string; content?: unknown }) => {
    if (!KINDS.includes(input.kind as StudioKind)) throw new Error("tipo inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("studio_projects")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: (data.title || "Sin título").slice(0, 120),
      })
      .select("id, kind, title, thumbnail, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);

    const { error: docErr } = await context.supabase.from("studio_docs").insert({
      project_id: proj.id,
      user_id: context.userId,
      content: (data.content ?? {}) as never,
    });
    if (docErr) throw new Error(docErr.message);

    return { project: proj as StudioProject };
  });

export const getStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("studio_projects")
      .select("id, kind, title, thumbnail, created_at, updated_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proj) throw new Error("Proyecto no encontrado");

    const { data: doc } = await context.supabase
      .from("studio_docs")
      .select("content")
      .eq("project_id", data.id)
      .maybeSingle();

    return { project: proj as StudioProject, content: doc?.content ?? {} } as StudioDoc;
  });

export const saveStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; content?: unknown; title?: string; thumbnail?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (typeof data.title === "string") patch.title = data.title.slice(0, 120);
    if (data.thumbnail !== undefined) patch.thumbnail = data.thumbnail;
    if (Object.keys(patch).length > 0) {
      const { error } = await context.supabase
        .from("studio_projects")
        .update(patch as never)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }

    if (data.content !== undefined) {
      const { error } = await context.supabase.from("studio_docs").upsert(
        {
          project_id: data.id,
          user_id: context.userId,
          content: data.content as never,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "project_id" },
      );
      if (error) throw new Error(error.message);
      await context.supabase
        .from("studio_projects")
        .update({ updated_at: new Date().toISOString() } as never)
        .eq("id", data.id)
        .eq("user_id", context.userId);
    }

    return { ok: true, savedAt: new Date().toISOString() };
  });

export const renameStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; title: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("studio_projects")
      .update({ title: data.title.slice(0, 120) } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("studio_projects")
      .select("kind, title, thumbnail")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proj) throw new Error("Proyecto no encontrado");

    const { data: doc } = await context.supabase
      .from("studio_docs")
      .select("content")
      .eq("project_id", data.id)
      .maybeSingle();

    const { data: copy, error: insErr } = await context.supabase
      .from("studio_projects")
      .insert({
        user_id: context.userId,
        kind: proj.kind,
        title: `${proj.title} (copia)`.slice(0, 120),
        thumbnail: proj.thumbnail,
      })
      .select("id, kind, title, thumbnail, created_at, updated_at")
      .single();
    if (insErr) throw new Error(insErr.message);

    await context.supabase.from("studio_docs").insert({
      project_id: copy.id,
      user_id: context.userId,
      content: (doc?.content ?? {}) as never,
    });

    return { project: copy as StudioProject };
  });

export const deleteStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("studio_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Texto creativo con IsaBot (títulos, copys, esquemas, mejoras). */
export const studioAiText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; system?: string }) => {
    if (!input.prompt?.trim()) throw new Error("Escribe qué necesitas");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { text: "", error: "La IA de texto no está disponible ahora mismo." };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              (data.system ??
                "Eres IsaBot, co-piloto de IA creativa de IsaRoRo Studio. Escribes en español, claro y cálido.") +
              " Responde solo con el contenido pedido, sin preámbulos ni comentarios.",
          },
          { role: "user", content: data.prompt.slice(0, 4000) },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { text: "", error: `IA no disponible (${res.status}): ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: json.choices?.[0]?.message?.content?.trim() ?? "", error: null as string | null };
  });

/** Imagen o fondo generado con IA, devuelto como data URL para el lienzo. */
export const studioAiImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => {
    if (!input.prompt?.trim()) throw new Error("Describe la imagen");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { image: null as string | null, error: "La generación de imágenes no está disponible." };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        modalities: ["image", "text"],
        messages: [{ role: "user", content: data.prompt.slice(0, 1500) }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const reason =
        res.status === 429
          ? "Demasiadas peticiones seguidas, intenta en un momento."
          : res.status === 402
            ? "Se agotaron los créditos de IA del proyecto."
            : `Error ${res.status}: ${body.slice(0, 200)}`;
      return { image: null as string | null, error: reason };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!url) return { image: null as string | null, error: "La IA no devolvió imagen, intenta describirla distinto." };
    return { image: url, error: null as string | null };
  });
