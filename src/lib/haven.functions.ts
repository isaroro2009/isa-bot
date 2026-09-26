import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ───────── Tareas con recompensa ───────── */
export const rewardTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ref: z.string().min(1).max(80), priority: z.string().max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const prio = data.priority === "high" ? "high" : data.priority === "med" ? "medium" : "low";
    const { data: rows, error } = await context.supabase.rpc("ibc_task_reward", { _task_ref: data.ref, _priority: prio });
    if (error) throw new Error(error.message);
    const r = (rows as Array<{ balance: number; delta: number }>)?.[0];
    return { balance: r?.balance ?? 0, delta: r?.delta ?? 0 };
  });

/* ───────── Museo de certificados ───────── */
export const listMuseum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("museum_certificates")
      .select("id, user_id, title, issuer, image_data, ai_verdict, valid, reward, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []).map((c) => ({ ...c, mine: c.user_id === context.userId }));
  });

export const uploadCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(2).max(120),
      issuer: z.string().trim().max(80).default(""),
      image: z.string().startsWith("data:image/").max(2_800_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("La validación con IA no está disponible ahora.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `¿Esta imagen es un certificado real de finalización de un curso o formación (con nombre, curso y emisor visibles)? Título declarado: "${data.title}". Responde SOLO JSON: {"valid": true|false, "reason": "frase corta en español"}`,
              },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Hay mucha demanda, inténtalo en un momento." : "No pude validar el certificado.");
    const json = await res.json();
    const txt: string = json?.choices?.[0]?.message?.content ?? "";
    let valid = false;
    let reason = "No se pudo leer el certificado.";
    try {
      const m = txt.match(/\{[\s\S]*\}/);
      const p = JSON.parse(m ? m[0] : txt);
      valid = Boolean(p.valid);
      reason = String(p.reason ?? reason).slice(0, 200);
    } catch { /* noop */ }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let reward = 0;
    if (valid) {
      const since = new Date(); since.setUTCHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("museum_certificates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId).gt("reward", 0).gte("created_at", since.toISOString());
      if ((count ?? 0) < 3) {
        reward = 50;
        await supabaseAdmin.rpc("ibc_admin_grant", { _user_id: context.userId, _amount: 50, _reason: "Certificado en IsaMuseum" });
      }
    }
    await supabaseAdmin.from("museum_certificates").insert({
      user_id: context.userId, title: data.title, issuer: data.issuer, image_data: data.image,
      ai_verdict: reason, valid, reward,
    });
    return { valid, reason, reward };
  });

export const deleteCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("museum_certificates").delete().eq("id", data.id);
    return { ok: true };
  });

/* ───────── Tienda de recompensas ───────── */
export const listRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: items }, { data: stock }, { data: mine }] = await Promise.all([
      context.supabase.from("reward_items").select("id, title, description, emoji, sponsor, cost, active").order("cost"),
      context.supabase.rpc("reward_stock"),
      context.supabase.from("reward_codes").select("id, code, redeemed_at, item_id").eq("redeemed_by", context.userId).order("redeemed_at", { ascending: false }),
    ]);
    const s = new Map(((stock ?? []) as Array<{ item_id: string; available: number }>).map((r) => [r.item_id, Number(r.available)]));
    return {
      items: (items ?? []).map((i) => ({ ...i, stock: s.get(i.id) ?? 0 })),
      mine: mine ?? [],
    };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("redeem_reward_code", { _item: data.itemId });
    if (error) {
      if (error.message.includes("insufficient_funds")) throw new Error("No tienes suficientes IsaBot Coins.");
      if (error.message.includes("out_of_stock")) throw new Error("Este premio está agotado por ahora.");
      throw new Error("No pude completar el canje.");
    }
    const r = (rows as Array<{ code: string; balance: number }>)?.[0];
    return { code: r?.code ?? "", balance: r?.balance ?? 0 };
  });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminSaveReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(2).max(80),
      description: z.string().trim().max(200).default(""),
      emoji: z.string().trim().max(8).default("🎁"),
      sponsor: z.string().trim().max(60).default(""),
      cost: z.number().int().min(1).max(100000),
      codes: z.array(z.string().trim().min(1).max(200)).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error } = await supabaseAdmin.from("reward_items").insert({
      title: data.title, description: data.description, emoji: data.emoji || "🎁", sponsor: data.sponsor, cost: data.cost,
    }).select("id").single();
    if (error || !item) throw new Error("No pude crear el premio");
    if (data.codes.length) await supabaseAdmin.from("reward_codes").insert(data.codes.map((code) => ({ item_id: item.id, code })));
    return { ok: true };
  });

export const adminAddCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid(), codes: z.array(z.string().trim().min(1).max(200)).min(1).max(500), active: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("reward_codes").insert(data.codes.map((code) => ({ item_id: data.itemId, code })));
    return { ok: true };
  });

export const adminToggleReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("reward_items").update({ active: data.active }).eq("id", data.itemId);
    return { ok: true };
  });
