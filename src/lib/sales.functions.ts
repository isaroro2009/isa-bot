import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SalesCampaign = {
  id: string;
  name: string;
  niche: string;
  city: string;
  offer: string;
  channels: string[];
  daily_limit: number;
  auto_send: boolean;
  active: boolean;
  last_run_at: string | null;
};

export type SalesProspect = {
  id: string;
  business_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  created_at: string;
};

export type SalesMessage = {
  id: string;
  prospect_id: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

export const listSalesCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalesCampaign[]> => {
    const { data } = await context.supabase
      .from("sales_campaigns")
      .select("id, name, niche, city, offer, channels, daily_limit, auto_send, active, last_run_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as SalesCampaign[];
  });

export const saveSalesCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    niche: string;
    city: string;
    offer: string;
    channels: string[];
    daily_limit: number;
    auto_send: boolean;
    active?: boolean;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        niche: z.string().trim().min(2).max(80),
        city: z.string().trim().min(2).max(80),
        offer: z.string().trim().min(10).max(600),
        channels: z.array(z.enum(["email", "whatsapp", "form"])).min(1),
        daily_limit: z.number().int().min(1).max(25),
        auto_send: z.boolean(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { error } = await context.supabase.from("sales_campaigns").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCampaignActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("sales_campaigns").update({ active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const deleteSalesCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("sales_campaigns").delete().eq("id", data.id);
    return { ok: true };
  });

export const listSalesProspects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalesProspect[]> => {
    const { data } = await context.supabase
      .from("sales_prospects")
      .select("id, business_name, website, email, phone, city, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as SalesProspect[];
  });

export const listSalesMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalesMessage[]> => {
    const { data } = await context.supabase
      .from("sales_messages")
      .select("id, prospect_id, channel, subject, body, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as SalesMessage[];
  });

export const markMessageSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["sent", "ready", "skipped", "replied"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("sales_messages")
      .update({ status: data.status, sent_at: data.status === "sent" ? new Date().toISOString() : null })
      .eq("id", data.id);
    return { ok: true };
  });

export const addManualProspects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaign_id: string; raw: string }) =>
    z.object({ campaign_id: z.string().uuid(), raw: z.string().min(3).max(20000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Formato por línea: Negocio, email, teléfono, web
    const rows = data.raw
      .split("\n")
      .map((l) => l.split(",").map((p) => p.trim()))
      .filter((p) => p[0])
      .slice(0, 200)
      .map((p) => ({
        user_id: context.userId,
        campaign_id: data.campaign_id,
        business_name: p[0]!,
        email: p[1] || null,
        phone: p[2] || null,
        website: p[3] || null,
        source: "manual",
        status: "new",
      }));
    if (!rows.length) return { ok: false, added: 0 };
    const { error } = await context.supabase
      .from("sales_prospects")
      .upsert(rows, { onConflict: "user_id,business_name,city", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

/** Corre ahora una campaña (lo mismo que hace de noche, pero a demanda). */
export const runSalesCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("sales_campaigns")
      .select("id, user_id, name, niche, city, offer, channels, daily_limit, auto_send")
      .eq("id", data.id)
      .maybeSingle();
    if (!c) throw new Error("Campaña no encontrada");
    const { runCampaign } = await import("./salesRun.server");
    return runCampaign(context.supabase, c);
  });
