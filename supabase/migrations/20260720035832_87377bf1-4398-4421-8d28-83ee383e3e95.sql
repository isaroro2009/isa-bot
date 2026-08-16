ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_gift_days integer,
  ADD COLUMN IF NOT EXISTS premium_notice_seen boolean NOT NULL DEFAULT true;