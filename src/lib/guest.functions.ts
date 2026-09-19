import { createServerFn } from "@tanstack/react-start";

export const GUEST_VIP_EMAIL = "invitado.vip@isabot.app";
const GUEST_VIP_PASSWORD = "IsaBotVIP-2026!demo";

/**
 * Garantiza que exista la cuenta de demostración "Andrés Bilbao".
 * Devuelve las credenciales para que el cliente inicie sesión normalmente.
 */
export const ensureGuestVip = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", GUEST_VIP_EMAIL)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: GUEST_VIP_EMAIL,
      password: GUEST_VIP_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Andrés Bilbao" },
    });
    // Si ya existía en auth (sin fila en profiles), seguimos adelante.
    if (error && !/already/i.test(error.message)) throw error;
  }

  return { email: GUEST_VIP_EMAIL, password: GUEST_VIP_PASSWORD };
});
