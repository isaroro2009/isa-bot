import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 🟦 Acciones reales del agente dentro de la cuenta de Google de la persona:
 * Drive, Calendar, Docs y Sheets. Usamos el `provider_token` de Google que
 * devuelve el login OAuth (ver src/lib/gmail.ts).
 */

type GoogleResult = { ok: boolean; reason?: string; id?: string; url?: string; name?: string };

async function google(
  token: string,
  url: string,
  init: { method?: string; body?: unknown; contentType?: string; raw?: BodyInit } = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; text: string }> {
  const res = await fetch(url, {
    method: init.method ?? "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": init.contentType ?? "application/json",
    },
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* respuesta no JSON */
  }
  return { ok: res.ok, status: res.status, json, text };
}

function fail(status: number, text: string): GoogleResult {
  if (status === 401 || status === 403) return { ok: false, reason: "google_unauthorized" };
  return { ok: false, reason: `google_error_${status}: ${text.slice(0, 200)}` };
}

function requireToken(t: unknown) {
  const token = String(t ?? "").trim();
  if (!token) throw new Error("Falta la autorización de Google");
  return token;
}

/** 📁 Sube un archivo (por defecto PDF en base64) al Drive de la persona. */
export const driveUploadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessToken: string; name: string; base64: string; mimeType?: string }) => {
    const base64 = (input.base64 ?? "").replace(/\s+/g, "");
    if (!base64) throw new Error("Archivo vacío");
    if (base64.length > 20_000_000) throw new Error("El archivo es demasiado grande");
    return {
      accessToken: requireToken(input.accessToken),
      name: (input.name ?? "documento.pdf").slice(0, 120),
      base64,
      mimeType: (input.mimeType ?? "application/pdf").slice(0, 80),
    };
  })
  .handler(async ({ data }): Promise<GoogleResult> => {
    const boundary = `isabot_${Date.now().toString(36)}`;
    const meta = JSON.stringify({ name: data.name, mimeType: data.mimeType });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${data.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${data.base64}\r\n` +
      `--${boundary}--`;

    const r = await google(
      data.accessToken,
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      { raw: body, contentType: `multipart/related; boundary=${boundary}` },
    );
    if (!r.ok) return fail(r.status, r.text);
    return {
      ok: true,
      id: String(r.json.id ?? ""),
      name: String(r.json.name ?? data.name),
      url: String(r.json.webViewLink ?? `https://drive.google.com/file/d/${String(r.json.id ?? "")}/view`),
    };
  });

/** 📅 Crea un evento en el Google Calendar de la persona. */
export const calendarCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      accessToken: string;
      summary: string;
      description?: string;
      startISO: string;
      endISO?: string;
      timeZone?: string;
    }) => {
      const summary = (input.summary ?? "").trim();
      if (summary.length < 2) throw new Error("Título inválido");
      const start = new Date(input.startISO ?? "");
      if (Number.isNaN(start.getTime())) throw new Error("Fecha de inicio inválida");
      const end = input.endISO ? new Date(input.endISO) : new Date(start.getTime() + 60 * 60 * 1000);
      if (Number.isNaN(end.getTime())) throw new Error("Fecha de fin inválida");
      return {
        accessToken: requireToken(input.accessToken),
        summary: summary.slice(0, 200),
        description: (input.description ?? "").slice(0, 4000),
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        timeZone: (input.timeZone ?? "UTC").slice(0, 60),
      };
    },
  )
  .handler(async ({ data }): Promise<GoogleResult> => {
    const r = await google(
      data.accessToken,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        body: {
          summary: data.summary,
          description: data.description || undefined,
          start: { dateTime: data.startISO, timeZone: data.timeZone },
          end: { dateTime: data.endISO, timeZone: data.timeZone },
          reminders: { useDefault: true },
        },
      },
    );
    if (!r.ok) return fail(r.status, r.text);
    return { ok: true, id: String(r.json.id ?? ""), url: String(r.json.htmlLink ?? "https://calendar.google.com/") };
  });

/** 📝 Crea un Google Doc con el contenido redactado por el agente. */
export const docsCreateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessToken: string; title: string; content: string }) => {
    const title = (input.title ?? "").trim() || "Documento de IsaBot";
    const content = (input.content ?? "").trim();
    if (content.length < 2) throw new Error("Contenido vacío");
    return {
      accessToken: requireToken(input.accessToken),
      title: title.slice(0, 150),
      content: content.slice(0, 60000),
    };
  })
  .handler(async ({ data }): Promise<GoogleResult> => {
    const created = await google(data.accessToken, "https://docs.googleapis.com/v1/documents", {
      body: { title: data.title },
    });
    if (!created.ok) return fail(created.status, created.text);
    const id = String(created.json.documentId ?? "");

    const filled = await google(data.accessToken, `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
      body: { requests: [{ insertText: { location: { index: 1 }, text: data.content } }] },
    });
    if (!filled.ok) return fail(filled.status, filled.text);

    return { ok: true, id, name: data.title, url: `https://docs.google.com/document/d/${id}/edit` };
  });

/** 📊 Crea una Google Sheet con filas (matriz de texto). */
export const sheetsCreateSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessToken: string; title: string; rows: string[][] }) => {
    const rows = Array.isArray(input.rows) ? input.rows.slice(0, 2000) : [];
    if (!rows.length) throw new Error("Sin filas para escribir");
    return {
      accessToken: requireToken(input.accessToken),
      title: (input.title ?? "Hoja de IsaBot").slice(0, 150),
      rows: rows.map((r) => (Array.isArray(r) ? r.slice(0, 50).map((c) => String(c ?? "").slice(0, 500)) : [])),
    };
  })
  .handler(async ({ data }): Promise<GoogleResult> => {
    const created = await google(data.accessToken, "https://sheets.googleapis.com/v4/spreadsheets", {
      body: { properties: { title: data.title } },
    });
    if (!created.ok) return fail(created.status, created.text);
    const id = String(created.json.spreadsheetId ?? "");

    const filled = await google(
      data.accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:append?valueInputOption=USER_ENTERED`,
      { body: { values: data.rows } },
    );
    if (!filled.ok) return fail(filled.status, filled.text);

    return {
      ok: true,
      id,
      name: data.title,
      url: String(created.json.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}/edit`),
    };
  });
