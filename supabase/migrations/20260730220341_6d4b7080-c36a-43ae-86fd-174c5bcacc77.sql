-- ============ profiles: username, referral, public profile, streaks ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID,
  ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS focus_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS focus_best_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_plan_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

-- generate referral codes for existing users
UPDATE public.profiles
   SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
 WHERE referral_code IS NULL;

ALTER TABLE public.b2b_leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'landing';

-- public read of public profiles (safe columns are enforced in app queries)
DROP POLICY IF EXISTS "Public profiles are viewable by anyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by anyone"
  ON public.profiles FOR SELECT TO anon
  USING (public_profile_enabled = true);
GRANT SELECT ON public.profiles TO anon;

DROP POLICY IF EXISTS "Posts of public profiles are viewable by anyone" ON public.isaspace_posts;
CREATE POLICY "Posts of public profiles are viewable by anyone"
  ON public.isaspace_posts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = isaspace_posts.user_id AND p.public_profile_enabled = true));
GRANT SELECT ON public.isaspace_posts TO anon;

-- ============ daily_plans ============
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  main_goal TEXT NOT NULL,
  energy TEXT NOT NULL DEFAULT 'normal',
  available_minutes INTEGER NOT NULL DEFAULT 180,
  status TEXT NOT NULL DEFAULT 'active',
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  recap TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plans TO authenticated;
GRANT ALL ON public.daily_plans TO service_role;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own daily plans"
  ON public.daily_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ plan_blocks ============
CREATE TABLE IF NOT EXISTS public.plan_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task',
  minutes INTEGER NOT NULL DEFAULT 25,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  skips INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_blocks_plan_idx ON public.plan_blocks (plan_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_blocks TO authenticated;
GRANT ALL ON public.plan_blocks TO service_role;
ALTER TABLE public.plan_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own plan blocks"
  ON public.plan_blocks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_plan_blocks_updated_at
  BEFORE UPDATE ON public.plan_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ referrals ============
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  points_awarded BOOLEAN NOT NULL DEFAULT false,
  premium_awarded BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invitee_id)
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see referrals they made"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ referral claim ============
CREATE OR REPLACE FUNCTION public.claim_referral(_code TEXT)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ref UUID;
  _active_count INT;
  _premium_owed INT;
  _premium_given INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RETURN QUERY SELECT false, 'código vacío'; RETURN; END IF;

  SELECT id INTO _ref FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF _ref IS NULL OR _ref = _uid THEN RETURN QUERY SELECT false, 'código inválido'; RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE invitee_id = _uid) THEN
    RETURN QUERY SELECT false, 'ya usaste una invitación'; RETURN;
  END IF;

  UPDATE public.profiles SET referred_by = _ref WHERE id = _uid AND referred_by IS NULL;

  INSERT INTO public.referrals (referrer_id, invitee_id, status, points_awarded, activated_at)
  VALUES (_ref, _uid, 'active', true, now());

  PERFORM public.ensure_user_points_row(_ref);
  PERFORM public.ensure_user_points_row(_uid);

  UPDATE public.user_points SET points = points + 25, lifetime_points = lifetime_points + 25 WHERE user_id = _ref;
  INSERT INTO public.point_events(user_id, kind, delta, meta) VALUES (_ref, 'referral', 25, jsonb_build_object('invitee', _uid));

  UPDATE public.user_points SET points = points + 15, lifetime_points = lifetime_points + 15 WHERE user_id = _uid;
  INSERT INTO public.point_events(user_id, kind, delta, meta) VALUES (_uid, 'referral_welcome', 15, jsonb_build_object('referrer', _ref));

  -- 7 días premium por cada 3 invitadas activas
  SELECT COUNT(*) INTO _active_count FROM public.referrals WHERE referrer_id = _ref AND status = 'active';
  SELECT COUNT(*) INTO _premium_given FROM public.referrals WHERE referrer_id = _ref AND premium_awarded = true;
  _premium_owed := (_active_count / 3) - (_premium_given / 3);

  IF _premium_owed > 0 THEN
    UPDATE public.profiles
       SET is_premium = true,
           premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (_premium_owed * 7 || ' days')::interval,
           premium_gift_days = COALESCE(premium_gift_days, 0) + (_premium_owed * 7),
           premium_notice_seen = false
     WHERE id = _ref;

    UPDATE public.referrals SET premium_awarded = true
     WHERE id IN (
       SELECT id FROM public.referrals
        WHERE referrer_id = _ref AND status = 'active' AND premium_awarded = false
        ORDER BY created_at LIMIT (_premium_owed * 3)
     );
  END IF;

  RETURN QUERY SELECT true, 'invitación aplicada';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;

-- referral code for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    upper(substr(replace(NEW.id::text, '-', ''), 1, 8))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_points (user_id, points, lifetime_points, signup_bonus_granted)
  VALUES (NEW.id, 10, 10, true)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.point_events (user_id, kind, delta) VALUES (NEW.id, 'signup', 10);

  RETURN NEW;
END;
$$;