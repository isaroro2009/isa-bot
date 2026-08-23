import { createFileRoute } from "@tanstack/react-router";
import { BRAIN_BY_ID } from "@/lib/brains";


// 🤖 Modo Agente de IsaBot: loop real de herramientas (tool calling).
// IsaBot decide qué hacer: buscar en la web, leer páginas, redactar y
// ENVIAR correos por la persona, y crear recordatorios por correo.
// Motor: IsaBot-model-AI v1 (rebrand, nunca se menciona el proveedor).

type AgentStep =
  | { kind: "thought"; text: string }
  | { kind: "tool_call"; tool: string; input: string }
  | { kind: "tool_result"; tool: string; summary: string }
  | { kind: "final"; text: string; sources: Array<{ title: string; url: string }> };

const AGENT_MODEL = "openai/gpt-oss-120b";
const MAX_TURNS = 6;
const MAX_EMAILS_PER_RUN = 3;

const AGENT_SYSTEM = [
  "Eres IsaBot en Modo Agente, potenciada por el modelo IsaBot-model-AI v1, creado por Isabella Rodríguez Roque en IsaRoRo Studio.",
  "NUNCA menciones Google, Gemini, OpenAI, GPT, Anthropic, Claude, Groq, Meta, Llama ni ninguna otra empresa o modelo externo. Si preguntan qué modelo eres, responde 'IsaBot-model-AI v1'.",
  "Eres AGÉNTICA: tienes herramientas reales y las usas por iniciativa propia para completar la tarea de punta a punta.",
  "Herramientas: web_search (buscar), fetch_page (leer una URL), send_email (enviar un correo de verdad en nombre de la persona), create_reminder (programar un recordatorio por correo).",
  "Reglas de correo: solo envía a direcciones que la persona te dio o que encontraste en una fuente pública verificable. Nunca inventes direcciones. Redacta breve, humano y sin promesas falsas. Si no hay destinatario claro, pregunta antes de enviar.",
  "No inventes datos: si no lo verificaste con una herramienta, dilo.",
  "Estilo: directo, cálido, español neutro, máximo 2 emojis. Respuesta final en markdown limpio; si usaste la web, cierra con una sección **Fuentes** numerada.",
  "Cuando termines, resume qué acciones ejecutaste realmente (correos enviados, recordatorios creados).",
].join(" ");

type ToolDef = { type: "function"; function: { name: string; description: string; parameters: unknown } };

const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Busca en la web información fresca. Devuelve títulos, URLs y extractos.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Consulta de búsqueda" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_page",
      description: "Lee el texto de una URL pública (útil para verificar datos o encontrar contactos).",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "URL completa https://" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Envía un correo real en nombre de la persona. Úsalo solo con un destinatario válido y confirmado por la tarea.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Email del destinatario" },
          subject: { type: "string", description: "Asunto breve" },
          body: { type: "string", description: "Cuerpo del correo en texto plano o markdown simple" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crea un recordatorio que se enviará por correo a la persona.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          send_hour: { type: "number", description: "Hora UTC 0-23" },
          send_minute: { type: "number" },
          frequency: { type: "string", description: "once | daily | weekly" },
        },
        required: ["title", "send_hour", "frequency"],
      },
    },
  },
];

// ─── Herramientas ────────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": "IsaBot/1.0" } },
    );
    if (r.ok) {
      const data = (await r.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
      };
      if (data.AbstractText && data.AbstractURL) {
        results.push({ title: data.Heading ?? "Resumen", url: data.AbstractURL, snippet: data.AbstractText });
      }
      const flat: Array<{ Text?: string; FirstURL?: string }> = [];
      for (const t of data.RelatedTopics ?? []) {
        if (t.FirstURL && t.Text) flat.push(t);
        for (const sub of t.Topics ?? []) if (sub.FirstURL && sub.Text) flat.push(sub);
      }
      for (const t of flat.slice(0, 6)) {
        if (t.FirstURL && t.Text) results.push({ title: t.Text.slice(0, 90), url: t.FirstURL, snippet: t.Text });
      }
    }
  } catch {
    // seguimos con Wikipedia
  }
  if (results.length < 3) {
    try {
      const w = await fetch(
        `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`,
      );
      if (w.ok) {
        const wd = (await w.json()) as { query?: { search?: Array<{ title: string; snippet: string }> } };
        for (const item of wd.query?.search ?? []) {
          results.push({
            title: item.title,
            url: `https://es.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
            snippet: item.snippet.replace(/<[^>]+>/g, "").slice(0, 240),
          });
        }
      }
    } catch {
      // silent
    }
  }
  return results.slice(0, 8);
}

async function fetchPage(url: string): Promise<string> {
  try {
    if (!/^https?:\/\//i.test(url)) return "";
    const { safeFetch } = await import("@/lib/safe-fetch.server");
    const r = await safeFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 IsaBot-Agent/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r || !r.ok) return "";
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Ruta ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json({ error: "Necesitas iniciar sesión 💕" }, 401);

        const supaUrl = process.env.SUPABASE_URL;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supaUrl || !supaKey) return json({ error: "Configuración del servidor incompleta" }, 500);

        const { createClient } = await import("@supabase/supabase-js");
        const supaAuthed = createClient(supaUrl, supaKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await supaAuthed.auth.getUser(token);
        if (userErr || !userData?.user) return json({ error: "Sesión inválida 💔" }, 401);
        const user = userData.user;

        let body: { task?: string; brain?: string } = {};
        try {
          body = (await request.json()) as { task?: string; brain?: string };
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }
        const task = (body.task ?? "").trim();
        if (!task || task.length > 2000) return json({ error: "Tarea vacía o muy larga" }, 400);

        // Cerebro elegido: si es de Lovable AI (ej. Gemini Spark) usamos ese motor.
        const brain = body.brain ? BRAIN_BY_ID[body.brain] : undefined;
        const useLovable = brain?.provider === "lovable";
        // 🟦 Preferimos el motor directo de Google (Gemini) con la clave propia.
        const googleKey = process.env.GOOGLE_AI_API_KEY ?? "";
        const useGoogle = Boolean(googleKey);
        const endpoint = useGoogle
          ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
          : useLovable
            ? "https://ai.gateway.lovable.dev/v1/chat/completions"
            : "https://api.groq.com/openai/v1/chat/completions";
        // IDs estables: los numerados (gemini-2.5-flash…) devuelven 404.
        const modelId = useGoogle
          ? "gemini-flash-latest"
          : useLovable
            ? brain!.engine
            : AGENT_MODEL;
        const modelFallbacks = useGoogle
          ? ["gemini-flash-lite-latest", "gemini-pro-latest"]
          : [];

        const key = useGoogle ? googleKey : useLovable ? process.env.LOVABLE_API_KEY : process.env.GROQ_API_KEY;
        if (!key) return json({ error: "Falta la clave del motor de IA" }, 500);


        const steps: AgentStep[] = [];
        const sources: Array<{ title: string; url: string }> = [];
        const actions: string[] = [];
        let emailsSent = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = [
          { role: "system", content: AGENT_SYSTEM },
          {
            role: "user",
            content:
              `Tarea: ${task}\n\n` +
              `Datos de la persona: email ${user.email ?? "desconocido"}. ` +
              `Hoy es ${new Date().toISOString().slice(0, 16)} UTC.`,
          },
        ];

        async function runTool(name: string, argsRaw: string): Promise<string> {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(argsRaw || "{}") as Record<string, unknown>;
          } catch {
            return "Argumentos inválidos.";
          }

          if (name === "web_search") {
            const q = String(args.query ?? "").slice(0, 200);
            steps.push({ kind: "tool_call", tool: "web_search", input: q });
            const found = await webSearch(q);
            for (const f of found.slice(0, 4)) {
              if (!sources.some((s) => s.url === f.url)) sources.push({ title: f.title, url: f.url });
            }
            steps.push({ kind: "tool_result", tool: "web_search", summary: `${found.length} resultados` });
            return found.length
              ? found.map((f, i) => `[${i + 1}] ${f.title}\n${f.url}\n${f.snippet}`).join("\n\n")
              : "Sin resultados.";
          }

          if (name === "fetch_page") {
            const url = String(args.url ?? "");
            steps.push({ kind: "tool_call", tool: "fetch_page", input: url });
            const text = await fetchPage(url);
            steps.push({
              kind: "tool_result",
              tool: "fetch_page",
              summary: text ? `${text.length} caracteres leídos` : "no accesible",
            });
            return text || "No pude leer la página.";
          }

          if (name === "send_email") {
            const to = String(args.to ?? "").trim();
            const subject = String(args.subject ?? "").trim().slice(0, 160);
            const bodyText = String(args.body ?? "").trim().slice(0, 4000);
            steps.push({ kind: "tool_call", tool: "send_email", input: `${to} — ${subject}` });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to) || !subject || !bodyText) {
              steps.push({ kind: "tool_result", tool: "send_email", summary: "datos inválidos" });
              return "Datos de correo inválidos: revisa destinatario, asunto y cuerpo.";
            }
            if (emailsSent >= MAX_EMAILS_PER_RUN) {
              steps.push({ kind: "tool_result", tool: "send_email", summary: "límite alcanzado" });
              return `Límite de ${MAX_EMAILS_PER_RUN} correos por tarea alcanzado.`;
            }
            const { checkEmailQuota, recordEmailSent, EMAIL_DAILY_LIMIT } = await import(
              "@/lib/email-quota.server"
            );
            const quota = await checkEmailQuota(user.id);
            if (!quota.allowed) {
              steps.push({ kind: "tool_result", tool: "send_email", summary: "límite diario alcanzado" });
              return `Límite diario de ${EMAIL_DAILY_LIMIT} correos alcanzado. Entrega el borrador a la persona.`;
            }
            const { sendEmail, isMailConfigured, emailLayout } = await import("@/lib/mailer.server");
            if (!isMailConfigured()) {
              steps.push({ kind: "tool_result", tool: "send_email", summary: "correo no configurado — borrador listo" });
              return "El envío de correos no está activo en este proyecto. Entrega el borrador a la persona para que lo copie y lo envíe.";
            }
            const html = emailLayout({
              title: subject,
              body: `<p>${escapeHtml(bodyText).replace(/\n/g, "<br/>")}</p>`,
            } as Parameters<typeof emailLayout>[0]);
            const result = await sendEmail({ to, subject, html, kind: "agent" });
            steps.push({
              kind: "tool_result",
              tool: "send_email",
              summary: result.sent ? `enviado a ${to}` : `falló (${result.reason ?? "error"})`,
            });
            if (result.sent) {
              emailsSent++;
              await recordEmailSent(user.id, to);
              actions.push(`📤 Correo enviado a ${to} — “${subject}”`);
              return "Correo enviado correctamente.";
            }
            return `No se pudo enviar: ${result.reason ?? "error"}.`;
          }

          if (name === "create_reminder") {
            const title = String(args.title ?? "").trim().slice(0, 160);
            const message = String(args.message ?? "").trim().slice(0, 600) || null;
            const hour = Math.min(23, Math.max(0, Math.round(Number(args.send_hour ?? 9))));
            const minute = Math.min(59, Math.max(0, Math.round(Number(args.send_minute ?? 0))));
            const freqRaw = String(args.frequency ?? "daily");
            const frequency = ["once", "daily", "weekly"].includes(freqRaw) ? freqRaw : "daily";
            steps.push({ kind: "tool_call", tool: "create_reminder", input: `${title} · ${hour}:${String(minute).padStart(2, "0")} UTC` });
            if (!title) {
              steps.push({ kind: "tool_result", tool: "create_reminder", summary: "sin título" });
              return "El recordatorio necesita un título.";
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supaAuthed as any).from("user_reminders").insert({
              user_id: user.id,
              kind: "tarea",
              title,
              message,
              frequency,
              send_hour: hour,
              send_minute: minute,
              weekday: frequency === "weekly" ? 1 : null,
              once_date: frequency === "once" ? new Date().toISOString().slice(0, 10) : null,
              active: true,
            });
            steps.push({
              kind: "tool_result",
              tool: "create_reminder",
              summary: error ? "no se pudo crear" : "recordatorio creado",
            });
            if (error) return `No pude crear el recordatorio: ${error.message}`;
            actions.push(`⏰ Recordatorio creado: ${title} (${frequency})`);
            return "Recordatorio creado.";
          }

          return "Herramienta desconocida.";
        }

        steps.push({ kind: "thought", text: "Analizando la tarea y eligiendo herramientas…" });

        // Llama al modelo probando IDs alternativos si alguno ya no existe (404/400).
        async function callModel(): Promise<Response> {
          let last: Response | null = null;
          for (const m of [modelId, ...modelFallbacks]) {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: useLovable
                ? { "Content-Type": "application/json", "Lovable-API-Key": key! }
                : { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body: JSON.stringify({ model: m, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.2 }),
            });
            if (res.ok || res.status === 429) return res;
            last = res;
            if (res.status !== 404 && res.status !== 400) break;
          }
          // Último recurso: motor de Lovable AI si hay clave.
          const lovKey = process.env.LOVABLE_API_KEY;
          if (!useLovable && lovKey) {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Lovable-API-Key": lovKey },
              body: JSON.stringify({
                model: "google/gemini-3.7-flash",
                messages,
                tools: TOOLS,
                tool_choice: "auto",
              }),
            });
            if (res.ok) return res;
            last = res;
          }
          return last ?? new Response("sin respuesta", { status: 502 });
        }

        /** Plantilla local: garantiza contenido para el PDF aunque la IA falle. */
        function localDraft(): string {
          return [
            `## ${task.slice(0, 80)}`,
            "",
            "> Borrador generado localmente por IsaBot porque el motor de IA no estuvo disponible en este momento. Puedes editarlo y volver a intentarlo más tarde.",
            "",
            "## Objetivo",
            `- ${task}`,
            "",
            "## Puntos clave",
            "- Contexto y punto de partida",
            "- Acciones concretas a realizar",
            "- Recursos necesarios",
            "- Resultado esperado",
            "",
            "## Próximos pasos",
            "1. Revisar y completar los puntos anteriores",
            "2. Definir fechas y responsables",
            "3. Volver a pedirme el documento para la versión final ✨",
          ].join("\n");
        }

        let finalText = "";
        let degraded = false;
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const r = await callModel();
          if (!r.ok) {
            if (r.status === 429) return json({ error: "Rate limit — probá en un minuto." }, 429);
            finalText = localDraft();
            degraded = true;
            break;
          }

          const data = (await r.json()) as {
            choices?: Array<{
              message?: {
                content?: string;
                tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
              };
            }>;
          };
          const msg = data.choices?.[0]?.message;
          const calls = msg?.tool_calls ?? [];

          if (calls.length === 0) {
            finalText = msg?.content?.trim() ?? "";
            break;
          }

          messages.push({ role: "assistant", content: msg?.content ?? "", tool_calls: calls });
          if (msg?.content?.trim()) steps.push({ kind: "thought", text: msg.content.trim().slice(0, 300) });

          for (const c of calls) {
            const out = await runTool(c.function?.name ?? "", c.function?.arguments ?? "{}");
            messages.push({ role: "tool", tool_call_id: c.id, content: out.slice(0, 6000) });
          }
        }

        if (!finalText) {
          finalText =
            "Trabajé la tarea con mis herramientas pero me quedé sin pasos. Cuéntame un detalle más y sigo 💕";
        }
        if (actions.length) {
          finalText += `\n\n**Acciones ejecutadas**\n${actions.map((a) => `- ${a}`).join("\n")}`;
        }

        steps.push({ kind: "final", text: finalText, sources });
        return json({ steps, answer: finalText, sources, actions, degraded });

      },
    },
  },
});
