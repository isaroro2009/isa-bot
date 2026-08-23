
CREATE TABLE public.ibc_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 15,
  plan_status TEXT NOT NULL DEFAULT 'free',
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ibc_wallets TO authenticated;
GRANT ALL ON public.ibc_wallets TO service_role;
ALTER TABLE public.ibc_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibc_wallets_select_own" ON public.ibc_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ibc_wallets_updated_at BEFORE UPDATE ON public.ibc_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ibc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ibc_transactions_user_created_idx ON public.ibc_transactions (user_id, created_at DESC);
GRANT SELECT ON public.ibc_transactions TO authenticated;
GRANT ALL ON public.ibc_transactions TO service_role;
ALTER TABLE public.ibc_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibc_transactions_select_own" ON public.ibc_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ibc_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ibc_subscriptions_user_idx ON public.ibc_subscriptions (user_id);
GRANT SELECT ON public.ibc_subscriptions TO authenticated;
GRANT ALL ON public.ibc_subscriptions TO service_role;
ALTER TABLE public.ibc_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibc_subscriptions_select_own" ON public.ibc_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ibc_subscriptions_updated_at BEFORE UPDATE ON public.ibc_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure wallet for current user
CREATE OR REPLACE FUNCTION public.ibc_ensure_wallet()
RETURNS public.ibc_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.ibc_wallets;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.ibc_wallets (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO _row FROM public.ibc_wallets WHERE user_id = _uid;
  RETURN _row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ibc_ensure_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_ensure_wallet() TO authenticated, service_role;

-- Daily check-in: +1 IBC once per UTC day, tracks streak
CREATE OR REPLACE FUNCTION public.ibc_checkin()
RETURNS TABLE(balance integer, streak_days integer, delta integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _last TIMESTAMPTZ;
  _streak INT;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.last_checkin_at, w.streak_days INTO _last, _streak
  FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;

  IF _last IS NOT NULL AND (_last AT TIME ZONE 'UTC')::date >= _today THEN
    RETURN QUERY SELECT w.balance, w.streak_days, 0 FROM public.ibc_wallets w WHERE w.user_id = _uid;
    RETURN;
  END IF;

  IF _last IS NOT NULL AND (_last AT TIME ZONE 'UTC')::date = _today - 1 THEN
    _streak := COALESCE(_streak, 0) + 1;
  ELSE
    _streak := 1;
  END IF;

  UPDATE public.ibc_wallets
     SET balance = balance + 1, streak_days = _streak, last_checkin_at = now()
   WHERE user_id = _uid;

  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, 1, 'earn', 'Check-in diario');

  RETURN QUERY SELECT w.balance, w.streak_days, 1 FROM public.ibc_wallets w WHERE w.user_id = _uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ibc_checkin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_checkin() TO authenticated, service_role;

-- Spend coins atomically
CREATE OR REPLACE FUNCTION public.ibc_spend(_amount integer, _reason text)
RETURNS TABLE(balance integer, spent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _current INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 100 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.balance INTO _current FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;
  IF _current < _amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  IF _amount > 0 THEN
    UPDATE public.ibc_wallets SET balance = balance - _amount WHERE user_id = _uid;
    INSERT INTO public.ibc_transactions (user_id, amount, type, description)
    VALUES (_uid, -_amount, 'spend', COALESCE(left(_reason, 120), 'Acción'));
  END IF;

  RETURN QUERY SELECT w.balance, _amount FROM public.ibc_wallets w WHERE w.user_id = _uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ibc_spend(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_spend(integer, text) TO authenticated, service_role;

-- Grant coins (refunds / bonuses), capped
CREATE OR REPLACE FUNCTION public.ibc_grant(_amount integer, _reason text)
RETURNS TABLE(balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM public.ibc_ensure_wallet();

  UPDATE public.ibc_wallets SET balance = balance + _amount WHERE user_id = _uid;
  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, _amount, 'earn', COALESCE(left(_reason, 120), 'Abono'));

  RETURN QUERY SELECT w.balance FROM public.ibc_wallets w WHERE w.user_id = _uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ibc_grant(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_grant(integer, text) TO authenticated, service_role;

-- New users get a wallet with 15 IBC
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.ibc_wallets (user_id, balance) VALUES (NEW.id, 15)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 15, 'earn', 'Bono de bienvenida');

  RETURN NEW;
END;
$function$;
