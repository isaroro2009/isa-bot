-- Weekly gift queue
ALTER TABLE public.weekly_gifts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS queue_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

UPDATE public.weekly_gifts SET status = 'published', published_at = COALESCE(published_at, created_at) WHERE status = 'queued';

-- Profile reminder preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS last_inactivity_email_at TIMESTAMP WITH TIME ZONE;

-- Reminders
CREATE TABLE IF NOT EXISTS public.user_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'habit',
  title TEXT NOT NULL,
  message TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  send_hour INTEGER NOT NULL DEFAULT 8,
  send_minute INTEGER NOT NULL DEFAULT 0,
  weekday INTEGER,
  once_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reminders TO authenticated;
GRANT ALL ON public.user_reminders TO service_role;

ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reminders"
  ON public.user_reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_reminders_updated_at
  BEFORE UPDATE ON public.user_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS user_reminders_active_idx ON public.user_reminders (active, send_hour, send_minute);