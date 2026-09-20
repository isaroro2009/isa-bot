import { createServerFn } from "@tanstack/react-start";

/**
 * Acceso simplificado: sólo correo + nombre.
 * Crea la cuenta si no existe y devuelve las credenciales internas
 * para que el cliente abra la sesión al instante (sin contraseña visible).
 */
export const quickAccess = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; name?: string }) => {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Escribe un correo válido");
    }
    const name = (input.name ?? "").trim().slice(0, 60);
    return { email, name };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const displayName = data.name || data.email.split("@")[0];

    // Contraseña interna determinista (la usuaria nunca la escribe).
    const salt = process.env["QUICK_ACCESS_SALT"] ?? "isabot-quick-access-2026";
    const bytes = new TextEncoder().encode(`${salt}:${data.email}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const password = `Isa!${Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32)}`;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("email", data.email)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error && !/already/i.test(error.message)) throw error;
      if (data.name) {
        await supabaseAdmin
          .from("profiles")
          .update({ display_name: displayName })
          .eq("email", data.email);
      }
    } else {
      // Cuenta existente: sincronizamos la clave interna para el acceso directo.
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (!existing.display_name && data.name) {
        await supabaseAdmin
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", existing.id);
      }
    }

    return { email: data.email, password, isNew: !existing };
  });
