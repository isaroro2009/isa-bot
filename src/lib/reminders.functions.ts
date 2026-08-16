import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReminderKind = "habit" | "task";
export type ReminderFrequency = "once" | "daily" | "weekly";

export type Reminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  message: string | null;
  frequency: ReminderFrequency;
  send_hour: number;
  send_minute: number;
  weekday: number | null;
  once_date: string | null;
  active: boolean;
  last_sent_at: string | null;
  created_at: string;
};

export const listMyReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Reminder[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("user_reminders")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Reminder[];
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: ReminderKind;
      title: string;
      message?: string | null;
      frequency: ReminderFrequency;
      send_hour: number;
      send_minute?: number;
      weekday?: number | null;
      once_date?: string | null;
      scheduled_at?: string | null;
    }) => {
      if (!input.title?.trim()) throw new Error("El recordatorio necesita un título");
      if (input.title.length > 160) throw new Error("Título demasiado largo");
      if (input.message && input.message.length > 600) throw new Error("Mensaje demasiado largo");
      if (input.send_hour < 0 || input.send_hour > 23) throw new Error("Hora inválida");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("user_reminders").insert({
      user_id: context.userId,
      kind: data.kind,
      title: data.title.trim(),
      message: data.message?.trim() || null,
      frequency: data.frequency,
      send_hour: Math.round(data.send_hour),
      send_minute: Math.round(data.send_minute ?? 0),
      weekday: data.frequency === "weekly" ? (data.weekday ?? 1) : null,
      once_date: data.frequency === "once" ? (data.once_date ?? null) : null,
      scheduled_at: data.scheduled_at ?? null,
      active: true,
    });
    if (error) throw error;
    return { ok: true };
  });


export const toggleReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("user_reminders")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("user_reminders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Preferencia global de correos (recordatorios + avisos de inactividad). */
export const getEmailPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enabled: boolean; inactivity: boolean }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (context.supabase as any)
      .from("profiles")
      .select("email_reminders_enabled, inactivity_emails_enabled")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      enabled: data?.email_reminders_enabled ?? true,
      inactivity: data?.inactivity_emails_enabled ?? true,
    };
  });

export const setEmailPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled?: boolean; inactivity?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const patch: Record<string, boolean> = {};
    if (typeof data.enabled === "boolean") patch.email_reminders_enabled = data.enabled;
    if (typeof data.inactivity === "boolean") patch.inactivity_emails_enabled = data.inactivity;
    if (!Object.keys(patch).length) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

