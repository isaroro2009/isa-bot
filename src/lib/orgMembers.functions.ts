import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgMember = {
  id: string;
  user_id: string;
  role: "org_owner" | "org_admin" | "org_member";
  joined_at: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type OrgInvite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string }) =>
    z.object({ org_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OrgMember[]> => {
    const { data: members, error } = await context.supabase
      .from("organization_members")
      .select("id, user_id, role, joined_at")
      .eq("org_id", data.org_id);
    if (error) throw error;
    const ids = (members ?? []).map((m: any) => m.user_id);
    if (ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", ids);
    const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (members ?? []).map((m: any) => {
      const p = pMap.get(m.user_id) as any;
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        email: p?.email ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
  });

export const listOrgInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string }) =>
    z.object({ org_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OrgInvite[]> => {
    const { data: invites, error } = await context.supabase
      .from("organization_invites")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("org_id", data.org_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (invites ?? []) as OrgInvite[];
  });

export const createOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string; email: string; role?: "org_admin" | "org_member" }) =>
    z
      .object({
        org_id: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["org_admin", "org_member"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase
      .from("organization_invites")
      .insert({
        org_id: data.org_id,
        email: data.email.toLowerCase(),
        role: data.role ?? "org_member",
        invited_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return invite as OrgInvite;
  });

export const acceptOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!invite) throw new Error("Invitación no encontrada");
    if (invite.accepted_at) throw new Error("Invitación ya usada");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invitación expirada");

    // Verify email matches (get user email)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error(`Esta invitación es para ${invite.email}. Inicia sesión con esa cuenta.`);
    }

    // Add member (allowed by RLS: user_id = auth.uid())
    const { error: mErr } = await context.supabase
      .from("organization_members")
      .insert({
        org_id: invite.org_id,
        user_id: context.userId,
        role: invite.role,
        invited_by: invite.invited_by,
      });
    if (mErr && !mErr.message.includes("duplicate")) throw mErr;

    await supabaseAdmin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("slug")
      .eq("id", invite.org_id)
      .single();
    return { org_slug: org?.slug };
  });

export const updateOrgMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string; user_id: string; role: "org_owner" | "org_admin" | "org_member" }) =>
    z
      .object({
        org_id: z.string().uuid(),
        user_id: z.string().uuid(),
        role: z.enum(["org_owner", "org_admin", "org_member"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_members")
      .update({ role: data.role })
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string; user_id: string }) =>
    z.object({ org_id: z.string().uuid(), user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_members")
      .delete()
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invite_id: string }) =>
    z.object({ invite_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_invites")
      .delete()
      .eq("id", data.invite_id);
    if (error) throw error;
    return { ok: true };
  });
