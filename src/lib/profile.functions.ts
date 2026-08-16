import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  premium_gift_days: number | null;
  premium_notice_seen: boolean;
  headline: string | null;
  bio: string | null;
  location: string | null;
  interests: string[];
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, email, display_name, avatar_url, phone, is_premium, premium_expires_at, premium_gift_days, premium_notice_seen, headline, bio, location, interests",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Perfil no encontrado");

    // Auto-expira Premium temporal
    const p = data as MyProfile;
    if (p.is_premium && p.premium_expires_at) {
      const exp = new Date(p.premium_expires_at).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) {
        await context.supabase
          .from("profiles")
          .update({ is_premium: false, premium_gift_days: null })
          .eq("id", context.userId);
        p.is_premium = false;
        p.premium_gift_days = null;
      }
    }
    return p;
  });

export const acknowledgePremiumGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ premium_notice_seen: true })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    display_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    headline?: string | null;
    bio?: string | null;
    location?: string | null;
    interests?: string[];
  }) => {
    if (input.headline != null && input.headline.length > 80) {
      throw new Error("El titular no puede tener más de 80 caracteres");
    }
    if (input.bio != null && input.bio.length > 600) {
      throw new Error("La bio no puede tener más de 600 caracteres");
    }
    if (input.location != null && input.location.length > 60) {
      throw new Error("La ciudad no puede tener más de 60 caracteres");
    }
    if (input.interests != null && input.interests.length > 12) {
      throw new Error("Máximo 12 intereses");
    }
    if (input.display_name != null && input.display_name.length > 60) {
      throw new Error("El nombre no puede tener más de 60 caracteres");
    }
    if (input.avatar_url != null && input.avatar_url.length > 400_000) {
      throw new Error("La imagen es demasiado grande (máx ~300 KB)");
    }
    if (input.phone != null && input.phone.length > 30) {
      throw new Error("Teléfono inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const patch: {
      display_name?: string | null;
      avatar_url?: string | null;
      phone?: string | null;
      headline?: string | null;
      bio?: string | null;
      location?: string | null;
      interests?: string[];
    } = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.headline !== undefined) patch.headline = data.headline;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.location !== undefined) patch.location = data.location;
    if (data.interests !== undefined) {
      patch.interests = data.interests.map((t) => t.trim().slice(0, 30)).filter(Boolean);
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw error;
    return { ok: true };
  });
