import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("No se pudo verificar el rol");
  if (!data) throw new Error("Forbidden: se requiere rol admin");
}

const ALLOWED_EVENTS = new Set([
  "message_sent",
  "image_generated",
  "voice_call_started",
  "voice_call_ended",
  "feature_opened",
  "premium_activated",
  "user_signed_up",
]);

export const logEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { eventType: string; metadata?: Record<string, unknown> }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_EVENTS.has(data.eventType)) return { ok: false };
    await context.supabase.from("analytics_events").insert({
      user_id: context.userId,
      event_type: data.eventType,
      metadata: (data.metadata ?? {}) as any,
    });
    return { ok: true };
  });


export type MetricsResponse = {
  kpis: {
    totalUsers: number;
    activeToday: number;
    messagesToday: number;
    premiumUsers: number;
    premiumConversion: number;
  };
  messagesByDay: { date: string; count: number }[];
  signupsByDay: { date: string; count: number }[];
  hourlyUsage: { hour: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  featureUsage: { feature: string; count: number }[];
  topUsers: { name: string; email: string; count: number }[];

  liveFeed: {
    id: string;
    event_type: string;
    created_at: string;
    user_name: string | null;
    user_email: string | null;
  }[];
};

const FEATURE_LABELS: Record<string, string> = {
  message_sent: "💬 Chat",
  image_generated: "🎨 Imágenes",
  voice_call_started: "📞 Llamadas",
  feature_opened: "🧩 Features",
  premium_activated: "✨ Premium",
  user_signed_up: "🆕 Registros",
};

function bucketByDay(rows: { created_at: string }[], days: number) {
  const map = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const k = r.created_at.slice(0, 10);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([date, count]) => ({ date: date.slice(5), count }));
}

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetricsResponse> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const since14 = new Date(now - 14 * 86400_000).toISOString();
    const since7 = new Date(now - 7 * 86400_000).toISOString();

    const [
      { count: totalUsers },
      { count: premiumUsers },
      { count: messagesToday },
      { data: events14 },
      { data: events7 },
      { data: liveEvents },
      { data: topAgg },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_premium", true),
      supabaseAdmin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "message_sent")
        .gte("created_at", startOfToday.toISOString()),
      supabaseAdmin
        .from("analytics_events")
        .select("event_type, created_at")
        .gte("created_at", since14),
      supabaseAdmin
        .from("analytics_events")
        .select("event_type, user_id, created_at, metadata")
        .gte("created_at", since7),

      supabaseAdmin
        .from("analytics_events")
        .select("id, event_type, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("analytics_events")
        .select("user_id")
        .eq("event_type", "message_sent")
        .gte("created_at", since7),
    ]);

    // Active users today (auth listUsers via last_sign_in_at)
    let activeToday = 0;
    try {
      const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 500,
      });
      activeToday = (usersList?.users ?? []).filter(
        (u) =>
          u.last_sign_in_at &&
          new Date(u.last_sign_in_at).getTime() >= startOfToday.getTime(),
      ).length;
    } catch {}

    const messagesByDay = bucketByDay(
      (events14 ?? []).filter((e) => e.event_type === "message_sent"),
      14,
    );
    const signupsByDay = bucketByDay(
      (events14 ?? []).filter((e) => e.event_type === "user_signed_up"),
      14,
    );

    // Horas pico (últimos 7 días, hora local del servidor UTC)
    const hourBuckets = new Array(24).fill(0) as number[];
    for (const e of events7 ?? []) {
      const h = new Date(e.created_at as string).getUTCHours();
      hourBuckets[h] += 1;
    }
    const hourlyUsage = hourBuckets.map((count, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      count,
    }));

    // Temas más preguntados (7 días) — a partir de metadata.topic
    const topicMap = new Map<string, number>();
    for (const e of events7 ?? []) {
      if (e.event_type !== "message_sent") continue;
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const topic = typeof meta.topic === "string" && meta.topic.trim() ? meta.topic.trim() : null;
      if (!topic) continue;
      topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
    }
    const topTopics = Array.from(topicMap, ([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Feature usage (last 7 days)
    const featureMap = new Map<string, number>();
    for (const e of events7 ?? []) {
      const label = FEATURE_LABELS[e.event_type] ?? e.event_type;
      featureMap.set(label, (featureMap.get(label) ?? 0) + 1);
    }
    const featureUsage = Array.from(featureMap, ([feature, count]) => ({
      feature,
      count,
    })).sort((a, b) => b.count - a.count);

    // Top users
    const topMap = new Map<string, number>();
    for (const row of topAgg ?? []) {
      if (!row.user_id) continue;
      topMap.set(row.user_id, (topMap.get(row.user_id) ?? 0) + 1);
    }
    const topIds = Array.from(topMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const userIds = new Set<string>(topIds.map(([id]) => id));
    for (const e of liveEvents ?? []) if (e.user_id) userIds.add(e.user_id);

    let userInfo = new Map<string, { name: string | null; email: string | null }>();
    if (userIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", Array.from(userIds));
      for (const p of profs ?? []) {
        userInfo.set(p.id, { name: p.display_name, email: p.email });
      }
    }

    const topUsers = topIds.map(([id, count]) => ({
      name: userInfo.get(id)?.name ?? "—",
      email: userInfo.get(id)?.email ?? "",
      count,
    }));

    const liveFeed = (liveEvents ?? []).slice(0, 10).map((e) => ({
      id: e.id,
      event_type: e.event_type,
      created_at: e.created_at,
      user_name: e.user_id ? userInfo.get(e.user_id)?.name ?? null : null,
      user_email: e.user_id ? userInfo.get(e.user_id)?.email ?? null : null,
    }));

    return {
      kpis: {
        totalUsers: totalUsers ?? 0,
        activeToday,
        messagesToday: messagesToday ?? 0,
        premiumUsers: premiumUsers ?? 0,
        premiumConversion:
          totalUsers && totalUsers > 0
            ? Math.round(((premiumUsers ?? 0) / totalUsers) * 1000) / 10
            : 0,
      },
      messagesByDay,
      signupsByDay,
      hourlyUsage,
      topTopics,

      featureUsage,
      topUsers,
      liveFeed,
    };
  });
