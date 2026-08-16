// Server-only: fetch que bloquea SSRF (redes privadas, localhost, metadata cloud).

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reservado
  return false;
}

function isBlockedHost(hostnameRaw: string): boolean {
  const hostname = hostnameRaw.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) return true;
  if (!hostname.includes(".") && !hostname.includes(":")) return true; // hosts internos sin dominio
  if (isPrivateIPv4(hostname)) return true;
  // IPv6 loopback / link-local / unique-local
  if (hostname === "::1" || hostname === "::" ) return true;
  if (/^(fe80|fc|fd)/i.test(hostname) && hostname.includes(":")) return true;
  // IPv4 embebido en IPv6
  const v4 = hostname.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (hostname.includes(":") && v4 && isPrivateIPv4(v4[1]!)) return true;
  return false;
}

/** true solo si es una URL http(s) pública y segura de visitar. */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  return !isBlockedHost(u.hostname);
}

/**
 * fetch seguro para URLs de terceros: valida el host, sigue como máximo
 * `maxRedirects` saltos y revalida cada destino.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  maxRedirects = 2,
): Promise<Response | null> {
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isPublicHttpUrl(current)) return null;
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      try {
        current = new URL(loc, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}
