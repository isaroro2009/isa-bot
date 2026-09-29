/**
 * Guard for browser-exposed backend keys. Only publishable keys
 * (`sb_publishable_…`) or legacy anon JWTs are allowed in client code.
 * Secret keys (`sb_secret_…`) and JWTs with role=service_role are rejected.
 */
export function isSafeClientKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.startsWith("sb_secret_")) return false;
  if (k.startsWith("sb_publishable_")) return true;
  const parts = k.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: string };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function assertSafeClientKey(key: string | undefined | null, label = "VITE_SUPABASE_PUBLISHABLE_KEY") {
  if (!isSafeClientKey(key)) {
    throw new Error(
      `${label} must be a publishable (sb_publishable_) or anon JWT key. Secret/service_role keys are not allowed in the browser.`,
    );
  }
}
