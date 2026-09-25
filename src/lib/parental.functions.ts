import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PinSchema = z.string().regex(/^\d{4,8}$/, "La clave debe tener de 4 a 8 números");

async function hashPin(pin: string, saltHex?: string): Promise<string> {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex(salt)}:${hex(new Uint8Array(bits))}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function checkPin(userId: string, pin: string) {
  const db = await admin();
  const { data: row } = await db.from("parental_controls").select("*").eq("user_id", userId).maybeSingle();
  if (!row) throw new Error("Aún no hay clave de padres configurada");
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    throw new Error("Demasiados intentos. Espera 15 minutos.");
  }
  const [salt, expected] = row.pin_hash.split(":");
  const got = (await hashPin(pin, salt)).split(":")[1];
  if (got !== expected) {
    const fails = row.failed_attempts + 1;
    await db.from("parental_controls").update({
      failed_attempts: fails >= 5 ? 0 : fails,
      locked_until: fails >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
    }).eq("user_id", userId);
    throw new Error("Clave incorrecta");
  }
  if (row.failed_attempts) await db.from("parental_controls").update({ failed_attempts: 0 }).eq("user_id", userId);
  return row;
}

export const getParentalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("parental_controls").select("guide_mode").eq("user_id", context.userId).maybeSingle();
    return { configured: !!data, guideMode: (data?.guide_mode ?? "libre") as "academico" | "libre" };
  });

export const setupParentPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pin: string; currentPin?: string }) =>
    z.object({ pin: PinSchema, currentPin: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: existing } = await db.from("parental_controls").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (existing) {
      if (!data.currentPin) throw new Error("Ingresa la clave actual para cambiarla");
      await checkPin(context.userId, data.currentPin);
    }
    const pin_hash = await hashPin(data.pin);
    const { error } = await db.from("parental_controls").upsert(
      { user_id: context.userId, pin_hash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AREA_LABELS: Record<string, string> = {
  message_sent: "💬 Conversaciones con IsaBot",
  image_generated: "🎨 Creación de imágenes",
  voice_call_started: "📞 Llamadas de voz",
  feature_opened: "🧩 Herramientas",
  premium_activated: "✨ Premium",
};

export type ParentReport = {
  guideMode: "academico" | "libre";
  totalActions: number;
  activeDays: number;
  areas: { label: string; count: number }[];
  topics: { topic: string; count: number }[];
  hours: { morning: number; afternoon: number; evening: number; night: number };
  academy: { xp: number; streak: number; lessons: number } | null;
  moods: { mood: string; count: number }[];
  alerts: { mood: string; date: string; hasNote: boolean }[];
};

export const getParentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pin: string }) => z.object({ pin: z.string().min(1).max(12) }).parse(i))
  .handler(async ({ data, context }): Promise<ParentReport> => {
    const row = await checkPin(context.userId, data.pin);
    const db = await admin();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [{ data: events }, { data: feelings }, academyRes] = await Promise.all([
      db.from("analytics_events").select("event_type, created_at, metadata").eq("user_id", context.userId).gte("created_at", since).limit(5000),
      db.from("emotional_feedback").select("mood, created_at, message").eq("user_id", context.userId).gte("created_at", since).order("created_at", { ascending: false }),
      db.from("academy_streaks").select("streak, total_xp").eq("user_id", context.userId).maybeSingle(),
    ]);
    const { count: lessonsCount } = await db.from("academy_progress").select("id", { count: "exact", head: true }).eq("user_id", context.userId);

    const areaMap = new Map<string, number>();
    const topicMap = new Map<string, number>();
    const days = new Set<string>();
    const hours = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const e of events ?? []) {
      days.add(e.created_at.slice(0, 10));
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const label = e.event_type === "feature_opened" && typeof meta.feature === "string"
        ? `🧩 ${meta.feature}` : AREA_LABELS[e.event_type] ?? e.event_type;
      areaMap.set(label, (areaMap.get(label) ?? 0) + 1);
      if (typeof meta.topic === "string" && meta.topic.trim()) {
        const t = meta.topic.trim().slice(0, 40);
        topicMap.set(t, (topicMap.get(t) ?? 0) + 1);
      }
      // Hora local Colombia (UTC-5)
      const h = (new Date(e.created_at).getUTCHours() + 19) % 24;
      if (h >= 6 && h < 12) hours.morning++;
      else if (h < 18 && h >= 12) hours.afternoon++;
      else if (h >= 18 && h < 22) hours.evening++;
      else hours.night++;
    }

    const moodMap = new Map<string, number>();
    for (const f of feelings ?? []) moodMap.set(f.mood, (moodMap.get(f.mood) ?? 0) + 1);
    const alerts = (feelings ?? [])
      .filter((f) => f.mood === "frustrada" || f.mood === "confundida")
      .slice(0, 10)
      .map((f) => ({ mood: f.mood, date: f.created_at, hasNote: !!f.message }));

    const a = academyRes.data;
    const academy = a || lessonsCount
      ? { xp: a?.total_xp ?? 0, streak: a?.streak ?? 0, lessons: lessonsCount ?? 0 }
      : null;

    const sortMap = (m: Map<string, number>, n: number) =>
      Array.from(m, ([k, count]) => ({ k, count })).sort((x, y) => y.count - x.count).slice(0, n);

    return {
      guideMode: row.guide_mode as "academico" | "libre",
      totalActions: events?.length ?? 0,
      activeDays: days.size,
      areas: sortMap(areaMap, 8).map(({ k, count }) => ({ label: k, count })),
      topics: sortMap(topicMap, 8).map(({ k, count }) => ({ topic: k, count })),
      hours,
      academy,
      moods: sortMap(moodMap, 5).map(({ k, count }) => ({ mood: k, count })),
      alerts,
    };
  });

export const setGuideMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pin: string; mode: string }) =>
    z.object({ pin: z.string().min(1).max(12), mode: z.enum(["academico", "libre"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await checkPin(context.userId, data.pin);
    const db = await admin();
    const { error } = await db.from("parental_controls").update({ guide_mode: data.mode, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
