import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export type ReferralInfo = {
  code: string | null;
  username: string | null;
  publicProfileEnabled: boolean;
  invited: number;
  activated: number;
  pointsEarned: number;
  premiumDaysEarned: number;
  nextPremiumIn: number; // referidas activas que faltan para los próximos 7 días premium
  neonUnlocked: boolean; // tema Cyberpunk Neón: se desbloquea con 2 referidas activas
  neonGoal: number;
};




export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralInfo> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("referral_code, username, public_profile_enabled")
      .eq("id", userId)
      .maybeSingle();

    const { data: refs } = await supabase
      .from("referrals")
      .select("status, points_awarded, premium_awarded")
      .eq("referrer_id", userId);

    const list = refs ?? [];
    const activated = list.filter((r) => r.status === "activated" || r.status === "active").length;
    const pointsEarned = list.filter((r) => r.points_awarded).length * 25;
    const premiumDaysEarned = Math.floor(activated / 3) * 7;
    const nextPremiumIn = activated % 3 === 0 && activated > 0 ? 3 : 3 - (activated % 3);
    const NEON_GOAL = 2;

    return {
      code: prof?.referral_code ?? null,
      username: prof?.username ?? null,
      publicProfileEnabled: prof?.public_profile_enabled ?? false,
      invited: list.length,
      activated,
      pointsEarned,
      premiumDaysEarned,
      nextPremiumIn,
      neonUnlocked: activated >= NEON_GOAL,
      neonGoal: NEON_GOAL,
    };
  });

export const claimReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rpc, error } = await context.supabase.rpc("claim_referral", {
      _code: data.code.trim().toUpperCase(),
    });
    if (error) return { ok: false, message: error.message };
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    return { ok: Boolean(row?.ok), message: row?.message ?? "" };
  });

export const updatePublicProfileSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username?: string | null; enabled?: boolean }) =>
    z
      .object({
        username: z
          .string()
          .min(3)
          .max(24)
          .regex(/^[a-z0-9_.]+$/, "Solo minúsculas, números, punto y guion bajo")
          .nullable()
          .optional(),
        enabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { username?: string | null; public_profile_enabled?: boolean } = {};
    if (data.username !== undefined) patch.username = data.username;
    if (data.enabled !== undefined) patch.public_profile_enabled = data.enabled;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    if (error) {
      if (error.code === "23505") throw new Error("Ese nombre de usuario ya está tomado 💔");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export type PublicProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  interests: string[];
  referral_code: string | null;
  posts: Array<{ id: string; content: string; image_url: string | null; created_at: string }>;
};

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { username: string }) =>
    z.object({ username: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicProfile | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, headline, bio, location, interests, referral_code")
      .eq("public_profile_enabled", true)
      .eq("username", data.username.trim().toLowerCase())
      .maybeSingle();
    if (!prof?.id) return null;

    const { data: posts } = await supabaseAdmin
      .from("isaspace_posts")
      .select("id, content, image_url, created_at")
      .eq("user_id", prof.id)
      .order("created_at", { ascending: false })
      .limit(9);

    return {
      username: prof.username!,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      headline: prof.headline,
      bio: prof.bio,
      location: prof.location,
      interests: prof.interests ?? [],
      referral_code: prof.referral_code,
      posts: posts ?? [],
    };
  });

export const getInviterPreview = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ name: string | null; avatar: string | null } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("public_profile_enabled", true)
      .eq("referral_code", data.code.toUpperCase())
      .maybeSingle();
    if (!prof) return null;
    return { name: prof.display_name, avatar: prof.avatar_url };
  });

