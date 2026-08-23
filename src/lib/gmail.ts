/**
 * 📧 Conexión nativa con Gmail (Google OAuth).
 * Guardamos el `provider_token` que devuelve Google tras autorizar el scope
 * `gmail.send` para poder enviar correos desde la propia cuenta de la usuaria.
 */

const KEY = "isabot.gmail.token";
/** Permisos del agente dentro de la cuenta de Google: Gmail, Drive, Calendar, Docs y Sheets. */
const SCOPE = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

type Stored = { token: string; savedAt: number };

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

/** Los tokens de Google duran ~1h. */
export function getGmailToken(): string | null {
  const s = read();
  if (!s) return null;
  if (Date.now() - s.savedAt > 55 * 60 * 1000) return null;
  return s.token;
}

export function isGmailConnected(): boolean {
  return Boolean(getGmailToken());
}

export function disconnectGmail() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** Tras volver del OAuth, Supabase expone `provider_token` en la sesión. */
export async function captureGmailToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token;
    if (token) {
      localStorage.setItem(KEY, JSON.stringify({ token, savedAt: Date.now() } satisfies Stored));
      return token;
    }
  } catch {
    /* noop */
  }
  return getGmailToken();
}

/** Lanza el consentimiento de Google pidiendo el permiso de envío de Gmail. */
export async function connectGmail(returnTo?: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  try {
    sessionStorage.setItem("isabot.gmail.returnTo", returnTo ?? window.location.pathname);
  } catch {
    /* noop */
  }
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: SCOPE,
      redirectTo: `${window.location.origin}${returnTo ?? "/"}?gmail=connected`,
      queryParams: { prompt: "consent", access_type: "online", include_granted_scopes: "true" },
    },
  });
}
