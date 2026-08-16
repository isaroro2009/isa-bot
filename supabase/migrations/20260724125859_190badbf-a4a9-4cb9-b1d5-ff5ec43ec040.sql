
-- ═════════════════════════════════════════════════════════
-- 1) TABLAS
-- ═════════════════════════════════════════════════════════

CREATE TABLE public.user_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points INT NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  signup_bonus_granted BOOLEAN NOT NULL DEFAULT false,
  last_daily_award_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_points TO authenticated;
GRANT ALL ON public.user_points TO service_role;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own points" ON public.user_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all points" ON public.user_points
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- writes go through SECURITY DEFINER RPCs only

CREATE TABLE public.point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('signup','daily_chat','crack_mode','redeem','admin_grant')),
  delta INT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_point_events_user ON public.point_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.point_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all events" ON public.point_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.rewards_catalog (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cost INT NOT NULL CHECK (cost > 0),
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('sticker','planner','ebook')),
  asset_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards_catalog TO authenticated;
GRANT ALL ON public.rewards_catalog TO service_role;
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can view active rewards" ON public.rewards_catalog
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage rewards" ON public.rewards_catalog
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_code TEXT NOT NULL REFERENCES public.rewards_catalog(code) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_url TEXT,
  UNIQUE (user_id, reward_code)
);
GRANT SELECT ON public.user_rewards TO authenticated;
GRANT ALL ON public.user_rewards TO service_role;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.user_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all rewards" ON public.user_rewards
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- inserts through redeem_reward RPC only

-- updated_at triggers
CREATE TRIGGER trg_user_points_updated
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rewards_catalog_updated
  BEFORE UPDATE ON public.rewards_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═════════════════════════════════════════════════════════
-- 2) RPCs (SECURITY DEFINER)
-- ═════════════════════════════════════════════════════════

-- Ensures a row exists for the caller
CREATE OR REPLACE FUNCTION public.ensure_user_points_row(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_points (user_id, points, lifetime_points)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_user_points_row(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_points_row(UUID) TO authenticated;

-- Award points (validates caller, prevents self-grant abuse via kind whitelist + rate limits)
CREATE OR REPLACE FUNCTION public.award_points(_kind TEXT)
RETURNS TABLE(points INT, lifetime_points INT, delta INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _delta INT := 0;
  _now TIMESTAMPTZ := now();
  _last TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _kind NOT IN ('daily_chat','crack_mode') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  INSERT INTO public.user_points (user_id, points, lifetime_points)
  VALUES (_uid, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF _kind = 'daily_chat' THEN
    SELECT last_daily_award_at INTO _last FROM public.user_points WHERE user_id = _uid;
    IF _last IS NOT NULL AND _last::date >= (_now AT TIME ZONE 'UTC')::date THEN
      RETURN QUERY SELECT up.points, up.lifetime_points, 0 FROM public.user_points up WHERE up.user_id = _uid;
      RETURN;
    END IF;
    _delta := 2;
    UPDATE public.user_points SET last_daily_award_at = _now WHERE user_id = _uid;
  ELSIF _kind = 'crack_mode' THEN
    -- max 3 crack_mode awards per day per user (15 pts/day cap)
    IF (SELECT COUNT(*) FROM public.point_events
        WHERE user_id = _uid AND kind = 'crack_mode'
          AND created_at::date = (_now AT TIME ZONE 'UTC')::date) >= 3 THEN
      RETURN QUERY SELECT up.points, up.lifetime_points, 0 FROM public.user_points up WHERE up.user_id = _uid;
      RETURN;
    END IF;
    _delta := 5;
  END IF;

  UPDATE public.user_points
     SET points = points + _delta,
         lifetime_points = lifetime_points + _delta
   WHERE user_id = _uid;

  INSERT INTO public.point_events(user_id, kind, delta) VALUES (_uid, _kind, _delta);

  RETURN QUERY SELECT up.points, up.lifetime_points, _delta FROM public.user_points up WHERE up.user_id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.award_points(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_points(TEXT) TO authenticated;

-- Redeem a reward
CREATE OR REPLACE FUNCTION public.redeem_reward(_code TEXT)
RETURNS TABLE(points INT, asset_url TEXT, reward_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _cost INT;
  _asset TEXT;
  _current INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT cost, COALESCE(asset_url,'') INTO _cost, _asset
    FROM public.rewards_catalog
   WHERE code = _code AND active = true;
  IF _cost IS NULL THEN RAISE EXCEPTION 'reward not found'; END IF;

  INSERT INTO public.user_points (user_id, points, lifetime_points)
  VALUES (_uid, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.user_rewards WHERE user_id = _uid AND reward_code = _code) THEN
    RAISE EXCEPTION 'already redeemed';
  END IF;

  SELECT p.points INTO _current FROM public.user_points p WHERE p.user_id = _uid FOR UPDATE;
  IF _current < _cost THEN RAISE EXCEPTION 'not enough points'; END IF;

  UPDATE public.user_points SET points = points - _cost WHERE user_id = _uid;
  INSERT INTO public.user_rewards(user_id, reward_code, asset_url) VALUES (_uid, _code, _asset);
  INSERT INTO public.point_events(user_id, kind, delta, meta) VALUES (_uid, 'redeem', -_cost, jsonb_build_object('code', _code));

  RETURN QUERY SELECT p.points, _asset, _code FROM public.user_points p WHERE p.user_id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_reward(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(TEXT) TO authenticated;

-- ═════════════════════════════════════════════════════════
-- 3) Bono de bienvenida en handle_new_user
-- ═════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
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
$function$;

-- ═════════════════════════════════════════════════════════
-- 4) Seed catálogo
-- ═════════════════════════════════════════════════════════

INSERT INTO public.rewards_catalog (code, title, description, cost, asset_kind, asset_url, sort_order) VALUES
  ('sticker_pastel', 'Sticker digital pastel', 'Sticker exclusivo de IsaRoRo Studio para Procreate y GoodNotes.', 50, 'sticker', '/rewards/reward-sticker.png', 1),
  ('planner_daily',  'Plantilla diaria descargable', 'Plantilla para organizar tu día con estética IsaRoRo Studio.', 100, 'planner', '/rewards/reward-planner.png', 2),
  ('ebook_focus',    'Mini e-book de foco creativo', 'Mini-guía de foco y productividad creativa por IsaRoRo Studio.', 200, 'ebook',   '/rewards/reward-ebook.png', 3)
ON CONFLICT (code) DO NOTHING;
