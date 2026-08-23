import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveCost, type IbcActionKey } from "@/lib/ibc";

export type IbcWallet = {
  balance: number;
  planStatus: "free" | "pro";
  streakDays: number;
  lastCheckinAt: string | null;
  checkedInToday: boolean;
};

export type IbcTransaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IbcWallet> => {
    const { supabase, userId } = context;
    await supabase.rpc("ibc_ensure_wallet");
    const { data } = await supabase
      .from("ibc_wallets")
      .select("balance, plan_status, streak_days, last_checkin_at")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      balance: data?.balance ?? 0,
      planStatus: (data?.plan_status === "pro" ? "pro" : "free"),
      streakDays: data?.streak_days ?? 0,
      lastCheckinAt: data?.last_checkin_at ?? null,
      checkedInToday: isToday(data?.last_checkin_at ?? null),
    };
  });

export const getTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IbcTransaction[]> => {
    const { data } = await context.supabase
      .from("ibc_transactions")
      .select("id, amount, type, description, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as IbcTransaction[];
  });

export const checkin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ balance: number; streakDays: number; delta: number; milestone: number }> => {
    const { data, error } = await context.supabase.rpc("ibc_checkin");
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = Array.isArray(data) ? data[0] : data;
    return {
      balance: row?.balance ?? 0,
      streakDays: row?.streak_days ?? 0,
      delta: row?.delta ?? 0,
      milestone: row?.milestone ?? 0,
    };
  });

export const spend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: IbcActionKey; note?: string }) => input)
  .handler(async ({ data, context }): Promise<{ balance: number; spent: number; txId: string | null }> => {
    const { supabase, userId } = context;
    await supabase.rpc("ibc_ensure_wallet");
    const { data: wallet } = await supabase
      .from("ibc_wallets")
      .select("plan_status")
      .eq("user_id", userId)
      .maybeSingle();
    const isPro = wallet?.plan_status === "pro";
    const amount = effectiveCost(data.action, isPro);

    const { data: res, error } = await supabase.rpc("ibc_spend", {
      _amount: amount,
      _reason: data.note ?? data.action,
    });
    if (error) {
      if (error.message.includes("insufficient_funds")) throw new Error("insufficient_funds");
      throw new Error(error.message);
    }
    const row = Array.isArray(res) ? res[0] : res;
    return { balance: row?.balance ?? 0, spent: row?.spent ?? amount };
  });

export const refund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; note?: string }) => input)
  .handler(async ({ data, context }): Promise<{ balance: number }> => {
    const amount = Math.max(0, Math.min(100, Math.round(data.amount)));
    if (amount === 0) {
      const { data: w } = await context.supabase
        .from("ibc_wallets")
        .select("balance")
        .eq("user_id", context.userId)
        .maybeSingle();
      return { balance: w?.balance ?? 0 };
    }
    const { data: res, error } = await context.supabase.rpc("ibc_grant", {
      _amount: amount,
      _reason: data.note ?? "Reembolso",
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return { balance: row?.balance ?? 0 };
  });
