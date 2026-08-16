// Server-only: límite diario de correos por usuaria para evitar abuso del remitente.
// Se apoya en analytics_events (tiene user_id) para contar los envíos del día.

export const EMAIL_DAILY_LIMIT = 10;

type QuotaResult = { allowed: boolean; used: number; limit: number };

export async function checkEmailQuota(userId: string): Promise<QuotaResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "email_sent")
    .gte("created_at", since.toISOString());

  const used = count ?? 0;
  return { allowed: used < EMAIL_DAILY_LIMIT, used, limit: EMAIL_DAILY_LIMIT };
}

export async function recordEmailSent(userId: string, to: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("analytics_events").insert({
      user_id: userId,
      event_type: "email_sent",
      metadata: { domain: to.split("@")[1] ?? null },
    });
  } catch (e) {
    console.error("[email-quota] no se pudo registrar el envío", e);
  }
}
