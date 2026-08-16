ALTER TABLE public.user_reminders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS inactivity_emails_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS user_reminders_scheduled_at_idx
  ON public.user_reminders (scheduled_at)
  WHERE active = true AND scheduled_at IS NOT NULL;