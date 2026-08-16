import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MARKET_CATEGORIES = [
  "diseño",
  "desarrollo",
  "redes sociales",
  "video",
  "escritura",
  "ilustración",
  "marketing",
  "traducción",
  "otros",
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export type MarketService = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price_from: number;
  currency: string;
  delivery_days: number;
  contact: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  owner_avatar?: string | null;
};

export type MarketJob = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  currency: string;
  contact: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  owner_avatar?: string | null;
  applications_count?: number;
  applied?: boolean;
};

export type MarketApplication = {
  id: string;
  job_id: string;
  user_id: string;
  message: string;
  contact: string;
  status: string;
  created_at: string;
  applicant_name?: string | null;
  job_title?: string | null;
};

const SERVICE_COLS =
  "id, user_id, title, description, category, price_from, currency, delivery_days, contact, published, created_at, updated_at";
const JOB_COLS =
  "id, user_id, title, description, category, budget, currency, contact, status, created_at, updated_at";

function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function num(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function category(v: unknown): MarketCategory {
  const c = String(v ?? "").toLowerCase();
  return (MARKET_CATEGORIES as readonly string[]).includes(c) ? (c as MarketCategory) : "otros";
}

type Supa = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function ownerMap(supabase: Supa, ids: string[]) {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map<string, { name: string | null; avatar: string | null }>();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", unique);
  const map = new Map<string, { name: string | null; avatar: string | null }>();
  for (const p of (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>) {
    map.set(p.id, { name: p.display_name || p.username || null, avatar: p.avatar_url ?? null });
  }
  return map;
}

/* ─────────────── Servicios (freelancers ofrecen) ─────────────── */

export const listServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; category?: string; mine?: boolean } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("market_services").select(SERVICE_COLS);
    if (data.mine) q = q.eq("user_id", context.userId);
    else q = q.eq("published", true);
    if (data.category && data.category !== "todas") q = q.eq("category", category(data.category));
    const search = clean(data.search, 80);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const { data: rows, error } = await q.order("updated_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as MarketService[];
    const owners = await ownerMap(context.supabase, list.map((s) => s.user_id));
    return {
      services: list.map((s) => ({
        ...s,
        owner_name: owners.get(s.user_id)?.name ?? null,
        owner_avatar: owners.get(s.user_id)?.avatar ?? null,
      })),
    };
  });

export const saveService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      description?: string;
      category?: string;
      price_from?: number;
      currency?: string;
      delivery_days?: number;
      contact?: string;
      published?: boolean;
    }) => {
      if (!clean(input.title, 120)) throw new Error("El título es obligatorio");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      title: clean(data.title, 120),
      description: clean(data.description, 2000),
      category: category(data.category),
      price_from: num(data.price_from, 0, 1_000_000),
      currency: clean(data.currency, 8) || "USD",
      delivery_days: Math.round(num(data.delivery_days, 1, 365)),
      contact: clean(data.contact, 200),
      published: data.published !== false,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("market_services")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select(SERVICE_COLS)
        .single();
      if (error) throw new Error(error.message);
      return { service: row as MarketService };
    }
    const { data: row, error } = await context.supabase
      .from("market_services")
      .insert(payload)
      .select(SERVICE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { service: row as MarketService };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_services")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ─────────────── Proyectos (clientes publican) ─────────────── */

export const listJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; category?: string; mine?: boolean } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("market_jobs").select(JOB_COLS);
    if (data.mine) q = q.eq("user_id", context.userId);
    else q = q.eq("status", "open");
    if (data.category && data.category !== "todas") q = q.eq("category", category(data.category));
    const search = clean(data.search, 80);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as MarketJob[];
    const owners = await ownerMap(context.supabase, list.map((j) => j.user_id));

    const ids = list.map((j) => j.id);
    const applied = new Set<string>();
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: apps } = await context.supabase
        .from("market_applications")
        .select("job_id, user_id")
        .in("job_id", ids);
      for (const a of (apps ?? []) as Array<{ job_id: string; user_id: string }>) {
        counts.set(a.job_id, (counts.get(a.job_id) ?? 0) + 1);
        if (a.user_id === context.userId) applied.add(a.job_id);
      }
    }

    return {
      jobs: list.map((j) => ({
        ...j,
        owner_name: owners.get(j.user_id)?.name ?? null,
        owner_avatar: owners.get(j.user_id)?.avatar ?? null,
        applications_count: counts.get(j.id) ?? 0,
        applied: applied.has(j.id),
      })),
    };
  });

export const saveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      description?: string;
      category?: string;
      budget?: number;
      currency?: string;
      contact?: string;
      status?: string;
    }) => {
      if (!clean(input.title, 120)) throw new Error("El título es obligatorio");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      title: clean(data.title, 120),
      description: clean(data.description, 2000),
      category: category(data.category),
      budget: num(data.budget, 0, 1_000_000),
      currency: clean(data.currency, 8) || "USD",
      contact: clean(data.contact, 200),
      status: data.status === "closed" ? "closed" : "open",
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("market_jobs")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select(JOB_COLS)
        .single();
      if (error) throw new Error(error.message);
      return { job: row as MarketJob };
    }
    const { data: row, error } = await context.supabase
      .from("market_jobs")
      .insert(payload)
      .select(JOB_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { job: row as MarketJob };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_jobs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ─────────────── Postulaciones ─────────────── */

export const applyToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string; message?: string; contact?: string }) => {
    if (!clean(input.job_id, 60)) throw new Error("Proyecto inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("market_applications").insert({
      job_id: data.job_id,
      user_id: context.userId,
      message: clean(data.message, 1000),
      contact: clean(data.contact, 200),
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("Ya te postulaste a este proyecto");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_applications")
      .delete()
      .eq("job_id", data.job_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Postulaciones recibidas en mis proyectos + mis postulaciones enviadas. */
export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: myJobs } = await context.supabase
      .from("market_jobs")
      .select("id, title")
      .eq("user_id", context.userId);
    const jobTitles = new Map<string, string>(
      ((myJobs ?? []) as Array<{ id: string; title: string }>).map((j) => [j.id, j.title]),
    );

    const { data: rows, error } = await context.supabase
      .from("market_applications")
      .select("id, job_id, user_id, message, contact, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as MarketApplication[];
    const people = await ownerMap(context.supabase, list.map((a) => a.user_id));

    const received: MarketApplication[] = [];
    const sent: MarketApplication[] = [];
    for (const a of list) {
      const enriched = {
        ...a,
        applicant_name: people.get(a.user_id)?.name ?? null,
        job_title: jobTitles.get(a.job_id) ?? null,
      };
      if (jobTitles.has(a.job_id) && a.user_id !== context.userId) received.push(enriched);
      if (a.user_id === context.userId) sent.push(enriched);
    }
    return { received, sent };
  });

export const setApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "pending" | "accepted" | "rejected" }) => {
    if (!["pending", "accepted", "rejected"].includes(input.status)) throw new Error("Estado inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_applications")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
