import { createServerFn } from "@tanstack/react-start";

/**
 * Acceso con "llave personal" (ISA-XXXX-XXXX).
 * - registerWithKey: nombre + correo → crea la cuenta y genera la llave.
 * - loginWithKey: solo la llave → abre sesión (para otros dispositivos o visitas automáticas).
 * Las llaves se guardan hasheadas (SHA-256); nunca en claro.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `ISA-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function normalizeKey(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^ISA/, "");
  return clean.length === 8 ? `ISA-${clean.slice(0, 4)}-${clean.slice(4)}` : null;
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPassword() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return `Isa!${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export const registerWithKey = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; name?: string }) => {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo válido");
    const name = (input.name ?? "").trim().slice(0, 60);
    if (name.length < 2) throw new Error("Escribe tu nombre");
    return { email, name };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = randomPassword();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("email", data.email)
      .maybeSingle();

    let userId: string;
    if (existing) {
      const { data: hasKey } = await supabaseAdmin
        .from("access_keys")
        .select("user_id")
        .eq("user_id", existing.id)
        .maybeSingle();
      if (hasKey) {
        throw new Error("Este correo ya tiene cuenta. Entra con tu llave personal 🔑");
      }
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (!existing.display_name) {
        await supabaseAdmin.from("profiles").update({ display_name: data.name }).eq("id", userId);
      }
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: data.name },
      });
      if (error || !created.user) throw new Error(error?.message ?? "No pude crear la cuenta");
      userId = created.user.id;
      await supabaseAdmin.from("profiles").update({ display_name: data.name }).eq("id", userId);
    }

    const accessKey = newKey();
    const { error: keyErr } = await supabaseAdmin
      .from("access_keys")
      .upsert({ user_id: userId, key_hash: await sha256(accessKey), last_used_at: new Date().toISOString() });
    if (keyErr) throw new Error("No pude generar tu llave");

    return { email: data.email, password, accessKey, isNew: !existing };
  });

export const loginWithKey = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => {
    const key = normalizeKey(input.key ?? "");
    if (!key) throw new Error("La llave debe tener el formato ISA-XXXX-XXXX");
    return { key };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("access_keys")
      .select("user_id")
      .eq("key_hash", await sha256(data.key))
      .maybeSingle();
    if (!row) throw new Error("Llave no válida. Revísala e inténtalo de nuevo 🔑");

    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    if (error || !u.user?.email) throw new Error("No encontré tu cuenta");
    const password = randomPassword();
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
    await supabaseAdmin
      .from("access_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", row.user_id);

    return { email: u.user.email, password, key: data.key };
  });
