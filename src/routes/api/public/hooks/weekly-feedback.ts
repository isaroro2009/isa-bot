import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://isa-bot.lovable.app";

const KIND_LABEL: Record<string, string> = {
  idea: "💡 Idea nueva",
  problema: "🐞 Algo falla",
  amor: "💖 Me encanta",
  otro: "✨ Otro",
};

function authorized(request: Request): boolean {
  // Secreto exclusivo del servidor. NUNCA usar la publishable/anon key: es pública.
  const key = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-key") ?? "";
  if (!key || key.length < 16 || !provided) return false;
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function aiSummary(lines: string[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key || lines.length === 0) return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 260,
        messages: [
          {
            role: "system",
            content:
              "Eres IsaBot. Resume en español, en 3 o 4 frases cálidas y concretas, el feedback semanal de las usuarias: qué es lo más pedido, qué problema se repite y una recomendación de qué construir primero. Sin listas, sin markdown.",
          },
          { role: "user", content: lines.join("\n") },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[weekly-feedback] groq failed [${res.status}]: ${await res.text()}`);
      return "";
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    console.error("[weekly-feedback] groq error", e);
    return "";
  }
}

export const Route = createFileRoute("/api/public/hooks/weekly-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail, emailLayout } = await import("@/lib/mailer.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const since = new Date(Date.now() - 7 * 86400000).toISOString();

        const { data: rows, error } = await admin
          .from("feedback")
          .select("id, user_id, kind, rating, message, status, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const items = rows ?? [];
        const ids = [...new Set(items.map((r: { user_id: string }) => r.user_id))];
        const names = new Map<string, string>();
        if (ids.length) {
          const { data: profs } = await admin
            .from("profiles")
            .select("id, display_name, email")
            .in("id", ids);
          for (const p of profs ?? []) names.set(p.id, p.display_name || p.email || "Anónima");
        }

        // Destinatarios: todos los administradores
        const { data: adminRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
        const { data: adminProfiles } = adminIds.length
          ? await admin.from("profiles").select("email, display_name").in("id", adminIds)
          : { data: [] };
        const recipients = (adminProfiles ?? [])
          .map((p: { email: string }) => p.email)
          .filter(Boolean);

        const total = items.length;
        const avg = total
          ? (items.reduce((a: number, r: { rating: number }) => a + r.rating, 0) / total).toFixed(1)
          : "—";
        const byKind: Record<string, number> = {};
        for (const r of items) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

        const summary = await aiSummary(
          items.map(
            (r: { kind: string; rating: number; message: string }) =>
              `[${r.kind} ${r.rating}/5] ${r.message}`,
          ),
        );

        const kindsHtml = Object.entries(byKind)
          .map(([k, n]) => `<li>${KIND_LABEL[k] ?? k}: <b>${n}</b></li>`)
          .join("");

        const listHtml = items
          .map(
            (r: { user_id: string; kind: string; rating: number; message: string; created_at: string }) =>
              `<div style="border:1px solid #f0dcec;border-radius:14px;padding:12px;margin-bottom:10px;">
                <div style="font-size:12px;color:#a06b8a;font-weight:700;">${KIND_LABEL[r.kind] ?? r.kind} · ${"★".repeat(r.rating)} · ${names.get(r.user_id) ?? "Anónima"} · ${new Date(r.created_at).toLocaleDateString("es")}</div>
                <div style="margin-top:6px;">${escapeHtml(r.message)}</div>
              </div>`,
          )
          .join("");

        const html = emailLayout({
          title: `💡 Feedback de la semana (${total})`,
          body: `
            ${summary ? `<p style="background:#f8eefc;border-radius:14px;padding:12px;"><b>Resumen de IsaBot:</b> ${escapeHtml(summary)}</p>` : ""}
            <p><b>Total:</b> ${total} · <b>Promedio:</b> ${avg}/5</p>
            ${kindsHtml ? `<ul>${kindsHtml}</ul>` : ""}
            ${total ? listHtml : "<p>Esta semana no llegó feedback nuevo 🌸</p>"}
          `,
          ctaLabel: "Ver en el Panel Admin",
          ctaUrl: `${APP_URL}/admin`,
        });

        let sent = 0;
        const reasons: string[] = [];
        for (const to of recipients) {
          const res = await sendEmail({ to, subject: `💡 Feedback semanal de IsaBot (${total})`, html, kind: "weekly_feedback" });
          if (res.sent) sent += 1;
          else if (res.reason) reasons.push(res.reason);
        }

        return Response.json({ ok: true, total, avg, recipients: recipients.length, sent, reasons });
      },
    },
  },
});
