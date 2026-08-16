import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  bot_name: string;
  primary_color: string;
  secondary_color: string;
  plan: string;
  trial_ends_at: string;
  seats_limit: number;
  owner_id: string;
  created_at: string;
};

const slugRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const colorRegex = /^#[0-9a-fA-F]{6}$/;

export const listMyOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error: mErr } = await context.supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", context.userId);
    if (mErr) throw mErr;
    const ids = (memberships ?? []).map((m: any) => m.org_id);
    if (ids.length === 0) return [] as Array<Organization & { role: string }>;
    const { data: orgs, error: oErr } = await context.supabase
      .from("organizations")
      .select("*")
      .in("id", ids);
    if (oErr) throw oErr;
    const roleMap = new Map((memberships ?? []).map((m: any) => [m.org_id, m.role]));
    return (orgs ?? []).map((o: any) => ({ ...o, role: roleMap.get(o.id) as string }));
  });

export const getOrgBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().regex(slugRegex) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!org) throw new Error("Organización no encontrada");
    const { data: member, error: mErr } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) throw new Error("No perteneces a esta organización");
    return { org: org as Organization, role: member.role as string };
  });

export const checkSlugAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!slugRegex.test(data.slug)) return { available: false, reason: "Formato inválido (usa minúsculas, números y guiones, 3-32 caracteres)" };
    const { data: existing } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    return { available: !existing, reason: existing ? "Ya en uso" : null };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    slug: string;
    name: string;
    bot_name?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string | null;
  }) =>
    z
      .object({
        slug: z.string().regex(slugRegex),
        name: z.string().min(2).max(80),
        bot_name: z.string().min(1).max(40).optional(),
        primary_color: z.string().regex(colorRegex).optional(),
        secondary_color: z.string().regex(colorRegex).optional(),
        logo_url: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({
        slug: data.slug,
        name: data.name,
        bot_name: data.bot_name ?? "IsaBot",
        primary_color: data.primary_color ?? "#f9a8d4",
        secondary_color: data.secondary_color ?? "#c4b5fd",
        logo_url: data.logo_url ?? null,
        owner_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    // Add creator as owner-member (own INSERT allowed by RLS: user_id = auth.uid())
    const { error: mErr } = await context.supabase
      .from("organization_members")
      .insert({ org_id: org.id, user_id: context.userId, role: "org_owner" });
    if (mErr) throw mErr;
    return org as Organization;
  });

export const updateOrgBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    org_id: string;
    name?: string;
    bot_name?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string | null;
  }) =>
    z
      .object({
        org_id: z.string().uuid(),
        name: z.string().min(2).max(80).optional(),
        bot_name: z.string().min(1).max(40).optional(),
        primary_color: z.string().regex(colorRegex).optional(),
        secondary_color: z.string().regex(colorRegex).optional(),
        logo_url: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { org_id, ...patch } = data;
    const { error } = await context.supabase
      .from("organizations")
      .update(patch)
      .eq("id", org_id);
    if (error) throw error;
    return { ok: true };
  });
