import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointsSnapshot = {
  points: number;
  lifetime: number;
  nextRewardCost: number | null;
  nextRewardTitle: string | null;
  progressPct: number; // 0..100 hacia la próxima recompensa
};

export type RewardItem = {
  code: string;
  title: string;
  description: string;
  cost: number;
  asset_kind: "sticker" | "planner" | "ebook";
  asset_url: string | null;
  redeemed: boolean;
  redeemed_at: string | null;
};

export const getMyPoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PointsSnapshot> => {
    const { supabase, userId } = context;
    await supabase.rpc("ensure_user_points_row", { _user_id: userId });
    const { data: row } = await supabase
      .from("user_points")
      .select("points, lifetime_points")
      .eq("user_id", userId)
      .maybeSingle();
    const points = row?.points ?? 0;
    const lifetime = row?.lifetime_points ?? 0;

    const { data: redeemed } = await supabase
      .from("user_rewards")
      .select("reward_code")
      .eq("user_id", userId);
    const redeemedCodes = new Set((redeemed ?? []).map((r) => r.reward_code));

    const { data: catalog } = await supabase
      .from("rewards_catalog")
      .select("code, title, cost")
      .eq("active", true)
      .order("cost", { ascending: true });

    let nextCost: number | null = null;
    let nextTitle: string | null = null;
    let prevCost = 0;
    for (const r of catalog ?? []) {
      if (!redeemedCodes.has(r.code) && points < r.cost) {
        nextCost = r.cost;
        nextTitle = r.title;
        break;
      }
      prevCost = r.cost;
    }
    const denom = nextCost ? nextCost - prevCost : 0;
    const progressPct =
      nextCost === null
        ? 100
        : denom > 0
          ? Math.max(0, Math.min(100, Math.round(((points - prevCost) / denom) * 100)))
          : 100;
    return { points, lifetime, nextRewardCost: nextCost, nextRewardTitle: nextTitle, progressPct };
  });

export const listRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RewardItem[]> => {
    const { supabase, userId } = context;
    const { data: catalog, error } = await supabase
      .from("rewards_catalog")
      .select("code, title, description, cost, asset_kind, asset_url, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const { data: mine } = await supabase
      .from("user_rewards")
      .select("reward_code, redeemed_at, asset_url")
      .eq("user_id", userId);
    const byCode = new Map((mine ?? []).map((r) => [r.reward_code, r]));

    return (catalog ?? []).map((r) => {
      const m = byCode.get(r.code);
      return {
        code: r.code,
        title: r.title,
        description: r.description,
        cost: r.cost,
        asset_kind: r.asset_kind as RewardItem["asset_kind"],
        asset_url: (m?.asset_url as string | undefined) ?? (r.asset_url as string | null),
        redeemed: !!m,
        redeemed_at: (m?.redeemed_at as string | undefined) ?? null,
      };
    });
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input?.code || typeof input.code !== "string") throw new Error("Código inválido");
    return { code: input.code.slice(0, 60) };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rpc, error } = await supabase.rpc("redeem_reward", { _code: data.code });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    return {
      ok: true as const,
      points: (row?.points ?? 0) as number,
      asset_url: (row?.asset_url ?? null) as string | null,
      code: data.code,
    };
  });

export const awardDailyChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("award_points", { _kind: "daily_chat" });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { points: row?.points ?? 0, delta: row?.delta ?? 0 };
  });

export const awardCrackMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("award_points", { _kind: "crack_mode" });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { points: row?.points ?? 0, delta: row?.delta ?? 0 };
  });
