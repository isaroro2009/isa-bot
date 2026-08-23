import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeedbackKind = "idea" | "problema" | "amor" | "otro";
export type FeedbackStatus = "new" | "reviewed" | "planned" | "done";

export type FeedbackItem = {
  id: string;
  user_id: string;
  kind: string;
  rating: number;
  message: string;
  status: string;
  created_at: string;
};

export type AdminFeedbackItem = FeedbackItem & {
  author_name: string | null;
  author_email: string | null;
};

const submitSchema = z.object({
  kind: z.enum(["idea", "problema", "amor", "otro"]),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(4, "Cuéntame un poquito más").max(2000),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; rating: number; message: string }) =>
    submitSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      kind: data.kind,
      rating: data.rating,
      message: data.message,
    });
    if (error) throw new Error(error.message);

    // +5 IsaBot Coins, máximo una vez al día
    let awarded = 0;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("point_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "feedback")
      .gte("created_at", startOfDay.toISOString());

    if (!count) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("ensure_user_points_row", { _user_id: userId });
      const { data: row } = await supabase
        .from("user_points")
        .select("points, lifetime_points")
        .eq("user_id", userId)
        .maybeSingle();
      if (row) {
        await supabase
          .from("user_points")
          .update({ points: row.points + 5, lifetime_points: row.lifetime_points + 5 })
          .eq("user_id", userId);
        awarded = 5;
      }
    }

    return { ok: true as const, awarded };
  });

export const listMyFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackItem[]> => {
    const { data, error } = await context.supabase
      .from("feedback")
      .select("id, user_id, kind, rating, message, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedbackItem[];
  });

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supa = context.supabase as any;
  const { data: isAdmin } = await supa.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listAllFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminFeedbackItem[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("feedback")
      .select("id, user_id, kind, rating, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as FeedbackItem[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const names = new Map<string, { display_name: string | null; email: string | null }>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      for (const p of profs ?? []) names.set(p.id, { display_name: p.display_name, email: p.email });
    }

    return rows.map((r) => ({
      ...r,
      author_name: names.get(r.user_id)?.display_name ?? null,
      author_email: names.get(r.user_id)?.email ?? null,
    }));
  });

export const updateFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "reviewed", "planned", "done"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("feedback")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
