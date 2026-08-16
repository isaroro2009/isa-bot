import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanBlock = {
  id: string;
  title: string;
  kind: "task" | "break";
  minutes: number;
  focus_minutes: number;
  status: "pending" | "doing" | "done" | "skipped";
  sort_order: number;
  note: string | null;
};

export type DailyPlan = {
  id: string;
  plan_date: string;
  main_goal: string;
  energy: "low" | "normal" | "high";
  available_minutes: number;
  focus_minutes: number;
  status: "active" | "closed";
  recap: string | null;
  blocks: PlanBlock[];
  streak: number;
  bestStreak: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getTodayPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyPlan | null> => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_date", today())
      .maybeSingle();

    const { data: prof } = await supabase
      .from("profiles")
      .select("focus_streak, focus_best_streak")
      .eq("id", userId)
      .maybeSingle();

    if (!plan) return null;

    const { data: blocks } = await supabase
      .from("plan_blocks")
      .select("id, title, kind, minutes, focus_minutes, status, sort_order, note")
      .eq("plan_id", plan.id)
      .order("sort_order", { ascending: true });

    return {
      id: plan.id,
      plan_date: plan.plan_date,
      main_goal: plan.main_goal,
      energy: plan.energy as DailyPlan["energy"],
      available_minutes: plan.available_minutes,
      focus_minutes: plan.focus_minutes,
      status: plan.status as DailyPlan["status"],
      recap: plan.recap,
      blocks: (blocks ?? []) as PlanBlock[],
      streak: prof?.focus_streak ?? 0,
      bestStreak: prof?.focus_best_streak ?? 0,
    };
  });

export const createTodayPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { goal: string; energy: string; minutes: number }) =>
    z
      .object({
        goal: z.string().min(3).max(240),
        energy: z.enum(["low", "normal", "high"]),
        minutes: z.number().int().min(20).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DailyPlan> => {
    const { supabase, userId } = context;
    const { generatePlanBlocks } = await import("./dailyPlan.server");

    // Contexto de la persona para que el plan se sienta suyo
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, headline, bio, interests")
      .eq("id", userId)
      .maybeSingle();
    const { data: mem } = await supabase
      .from("user_memory")
      .select("goals, important, mood")
      .eq("user_id", userId)
      .maybeSingle();

    const ctxLines: string[] = [];
    if (prof?.display_name) ctxLines.push(`Se llama ${prof.display_name}.`);
    if (prof?.headline) ctxLines.push(`Se define como: ${prof.headline}.`);
    if (prof?.interests?.length) ctxLines.push(`Intereses: ${prof.interests.join(", ")}.`);
    if (mem?.goals?.length) ctxLines.push(`Metas que ya me contó: ${mem.goals.slice(0, 5).join(", ")}.`);
    if (mem?.mood) ctxLines.push(`Ánimo reciente: ${mem.mood}.`);

    const { blocks, note } = await generatePlanBlocks({
      goal: data.goal,
      energy: data.energy,
      minutes: data.minutes,
      context: ctxLines.join(" "),
    });

    // Un plan por día: reemplaza el de hoy si existe
    const { data: existing } = await supabase
      .from("daily_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_date", today())
      .maybeSingle();
    if (existing) await supabase.from("daily_plans").delete().eq("id", existing.id);

    const { data: plan, error } = await supabase
      .from("daily_plans")
      .insert({
        user_id: userId,
        plan_date: today(),
        main_goal: data.goal,
        energy: data.energy,
        available_minutes: data.minutes,
        recap: note || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const rows = blocks.map((b, i) => ({
      plan_id: plan.id,
      user_id: userId,
      title: b.title,
      kind: b.kind,
      minutes: b.minutes,
      sort_order: i,
    }));
    const { error: bErr } = await supabase.from("plan_blocks").insert(rows);
    if (bErr) throw new Error(bErr.message);

    const { data: saved } = await supabase
      .from("plan_blocks")
      .select("id, title, kind, minutes, focus_minutes, status, sort_order, note")
      .eq("plan_id", plan.id)
      .order("sort_order", { ascending: true });

    const { data: p2 } = await supabase
      .from("profiles")
      .select("focus_streak, focus_best_streak")
      .eq("id", userId)
      .maybeSingle();

    return {
      id: plan.id,
      plan_date: plan.plan_date,
      main_goal: plan.main_goal,
      energy: plan.energy as DailyPlan["energy"],
      available_minutes: plan.available_minutes,
      focus_minutes: plan.focus_minutes,
      status: plan.status as DailyPlan["status"],
      recap: plan.recap,
      blocks: (saved ?? []) as PlanBlock[],
      streak: p2?.focus_streak ?? 0,
      bestStreak: p2?.focus_best_streak ?? 0,
    };
  });

export const setBlockStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { blockId: string; status: string; focusMinutes?: number }) =>
    z
      .object({
        blockId: z.string().uuid(),
        status: z.enum(["pending", "doing", "done", "skipped"]),
        focusMinutes: z.number().int().min(0).max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { status: string; focus_minutes?: number } = { status: data.status };
    if (data.focusMinutes !== undefined) patch.focus_minutes = data.focusMinutes;
    const { data: row, error } = await supabase
      .from("plan_blocks")
      .update(patch)
      .eq("id", data.blockId)
      .eq("user_id", userId)
      .select("plan_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Recalcular minutos de foco del plan
    if (row?.plan_id) {
      const { data: all } = await supabase
        .from("plan_blocks")
        .select("focus_minutes")
        .eq("plan_id", row.plan_id);
      const total = (all ?? []).reduce((s, b) => s + (b.focus_minutes ?? 0), 0);
      await supabase.from("daily_plans").update({ focus_minutes: total }).eq("id", row.plan_id);
    }
    return { ok: true };
  });

export const closeTodayPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ recap: string; streak: number }> => {
    const { supabase, userId } = context;
    const { generateRecap } = await import("./dailyPlan.server");

    const { data: plan } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_date", today())
      .maybeSingle();
    if (!plan) throw new Error("No tienes un plan de hoy");

    const { data: blocks } = await supabase
      .from("plan_blocks")
      .select("title, status, kind, focus_minutes")
      .eq("plan_id", plan.id);

    const done = (blocks ?? []).filter((b) => b.status === "done").map((b) => b.title);
    const pending = (blocks ?? []).filter((b) => b.status !== "done" && b.kind === "task").map((b) => b.title);
    const focusMinutes = (blocks ?? []).reduce((s, b) => s + (b.focus_minutes ?? 0), 0);

    // Racha: solo cuenta si cerró al menos un bloque de trabajo
    const { data: prof } = await supabase
      .from("profiles")
      .select("focus_streak, focus_best_streak, last_plan_date")
      .eq("id", userId)
      .maybeSingle();

    let streak = prof?.focus_streak ?? 0;
    if (done.length > 0 && prof?.last_plan_date !== plan.plan_date) {
      const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      streak = prof?.last_plan_date === yesterday ? streak + 1 : 1;
      await supabase
        .from("profiles")
        .update({
          focus_streak: streak,
          focus_best_streak: Math.max(streak, prof?.focus_best_streak ?? 0),
          last_plan_date: plan.plan_date,
        })
        .eq("id", userId);
    }

    const recap = await generateRecap({
      goal: plan.main_goal,
      done,
      pending,
      focusMinutes,
      streak,
    });

    await supabase
      .from("daily_plans")
      .update({ status: "closed", recap, focus_minutes: focusMinutes })
      .eq("id", plan.id);

    if (done.length > 0) {
      await supabase.rpc("award_points", { _kind: "daily_chat" }).then(() => undefined);
    }

    return { recap, streak };
  });
