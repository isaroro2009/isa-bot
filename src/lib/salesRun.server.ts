// Ejecuta una campaña: descubre negocios, guarda prospectos y redacta mensajes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverBusinesses, findEmailOnWebsite, writeOutreach } from "./sales.server";

export type CampaignRow = {
  id: string;
  user_id: string;
  name: string;
  niche: string;
  city: string;
  offer: string;
  channels: string[];
  daily_limit: number;
  auto_send: boolean;
};

export type RunResult = {
  campaign: string;
  found: number;
  newProspects: number;
  messages: number;
  note: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runCampaign(supa: SupabaseClient<any>, c: CampaignRow): Promise<RunResult> {
  const limit = Math.min(25, Math.max(1, c.daily_limit));
  const found = await discoverBusinesses(c.niche, c.city, limit);

  let newProspects = 0;
  let messages = 0;

  for (const biz of found) {
    let email = biz.email;
    if (!email && biz.website) email = await findEmailOnWebsite(biz.website);

    const { data: prospect, error } = await supa
      .from("sales_prospects")
      .upsert(
        {
          user_id: c.user_id,
          campaign_id: c.id,
          business_name: biz.business_name,
          website: biz.website,
          email,
          phone: biz.phone,
          address: biz.address,
          city: c.city,
          niche: c.niche,
          status: email || biz.phone ? "new" : "sin_contacto",
        },
        { onConflict: "user_id,business_name,city", ignoreDuplicates: true },
      )
      .select("id, email, phone")
      .maybeSingle();

    if (error || !prospect) continue; // ya existía: no se repite el contacto
    newProspects++;

    const channels: Array<"email" | "whatsapp" | "form"> = [];
    if (c.channels.includes("email") && prospect.email) channels.push("email");
    if (c.channels.includes("whatsapp") && prospect.phone) channels.push("whatsapp");
    if (c.channels.includes("form") && biz.website && !prospect.email) channels.push("form");

    for (const channel of channels) {
      const msg = await writeOutreach({
        channel,
        business: biz.business_name,
        niche: c.niche,
        city: c.city,
        offer: c.offer,
        website: biz.website,
      });
      await supa.from("sales_messages").insert({
        user_id: c.user_id,
        prospect_id: prospect.id,
        campaign_id: c.id,
        channel,
        subject: msg.subject,
        body: msg.body,
        status: "ready",
      });
      messages++;
    }
  }

  await supa
    .from("sales_campaigns")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", c.id);

  return {
    campaign: c.name,
    found: found.length,
    newProspects,
    messages,
    note:
      messages === 0
        ? "No se encontraron negocios nuevos con contacto público esta noche."
        : "Mensajes listos para enviar con un toque.",
  };
}
