import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type B2BLead = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  employees_range: string | null;
  use_case: string | null;
  status: string;
  created_at: string;
};

// Public — no auth (landing form). Uses publishable client, RLS allows anon INSERT.
export const submitB2BLead = createServerFn({ method: "POST" })
  .inputValidator((input: {
    company_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    employees_range?: string;
    use_case?: string;
  }) =>
    z
      .object({
        company_name: z.string().min(2).max(120),
        contact_name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        employees_range: z.string().max(40).optional(),
        use_case: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supa = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await supa.from("b2b_leads").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listB2BLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<B2BLead[]> => {
    const { data, error } = await context.supabase
      .from("b2b_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as B2BLead[];
  });

export const updateB2BLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: z.string().max(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("b2b_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
