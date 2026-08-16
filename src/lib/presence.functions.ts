import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Marca al usuario actual como activo (latido cada ~60s desde el cliente). */
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (context.supabase as any)
      .from("profiles")
      .update({ last_seen_at: now, last_active_at: now })
      .eq("id", context.userId);

    return { ok: true };
  });

export type PresenceUser = {
  id: string;
  name: string;
  email: string;
  last_seen_at: string | null;
  online: boolean;
};

export const getPresence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ online: number; users: PresenceUser[] }> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("No se pudo verificar el rol");
    if (!isAdmin) throw new Error("Forbidden: se requiere rol admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, last_seen_at")
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(30);

    const threshold = Date.now() - 5 * 60 * 1000;
    const users = (data ?? []).map((p) => ({
      id: p.id,
      name: p.display_name || (p.email ?? "").split("@")[0] || "Anónima",
      email: p.email ?? "",
      last_seen_at: p.last_seen_at ?? null,
      online: !!p.last_seen_at && new Date(p.last_seen_at).getTime() >= threshold,
    }));
    return { online: users.filter((u) => u.online).length, users };
  });
