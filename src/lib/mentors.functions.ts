import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MentorApplication = {
  id: string;
  full_name: string;
  expertise: string;
  experience: string;
  links: string | null;
  contact: string;
  status: string;
  created_at: string;
};

export const getMyMentorApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MentorApplication | null> => {
    const { data, error } = await context.supabase
      .from("mentor_applications")
      .select("id, full_name, expertise, experience, links, contact, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as MentorApplication | null) ?? null;
  });

export const applyAsMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name: string;
      expertise: string;
      experience: string;
      links?: string;
      contact: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const full_name = (data.full_name ?? "").trim().slice(0, 120);
    const expertise = (data.expertise ?? "").trim().slice(0, 160);
    const experience = (data.experience ?? "").trim().slice(0, 2000);
    const contact = (data.contact ?? "").trim().slice(0, 160);
    if (!full_name || !expertise || !experience || !contact) {
      throw new Error("Completa todos los campos obligatorios 💜");
    }
    const { error } = await context.supabase.from("mentor_applications").insert({
      user_id: context.userId,
      full_name,
      expertise,
      experience,
      links: (data.links ?? "").trim().slice(0, 500) || null,
      contact,
    });
    if (error) throw error;
    return { ok: true as const };
  });
