import { createServerFn } from "@tanstack/react-start";

/**
 * Acceso simplificado: sólo correo + nombre.
 * Crea la cuenta si no existe y devuelve un token de un solo uso
 * para que el cliente abra la sesión al instante (sin contraseña).
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

    const makeLink = async () =>
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
      });

    let { data: link, error } = await makeLink();

    if (error) {
      // La cuenta todavía no existe: la creamos ya confirmada.
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createErr && !/already/i.test(createErr.message)) throw createErr;
      const retry = await makeLink();
      if (retry.error) throw retry.error;
      link = retry.data;
    }

    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) throw new Error("No pudimos generar el acceso, intenta de nuevo");

    const userId = link?.user?.id;
    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId)
        .is("display_name", null);
    }

    return { tokenHash, email: data.email, isNew: false };
  });
