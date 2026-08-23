
DROP FUNCTION IF EXISTS public.ibc_checkin();

CREATE OR REPLACE FUNCTION public.ibc_checkin()
RETURNS TABLE(balance integer, streak_days integer, delta integer, milestone integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _last TIMESTAMPTZ;
  _streak INT;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _bonus INT := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.last_checkin_at, w.streak_days INTO _last, _streak
  FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;

  IF _last IS NOT NULL AND (_last AT TIME ZONE 'UTC')::date >= _today THEN
    RETURN QUERY SELECT w.balance, w.streak_days, 0, 0 FROM public.ibc_wallets w WHERE w.user_id = _uid;
    RETURN;
  END IF;

  IF _last IS NOT NULL AND (_last AT TIME ZONE 'UTC')::date = _today - 1 THEN
    _streak := COALESCE(_streak, 0) + 1;
  ELSE
    _streak := 1;
  END IF;

  IF _streak % 7 = 0 THEN
    _bonus := 15;
  ELSIF _streak % 3 = 0 THEN
    _bonus := 5;
  END IF;

  UPDATE public.ibc_wallets
     SET balance = balance + 1 + _bonus, streak_days = _streak, last_checkin_at = now()
   WHERE user_id = _uid;

  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, 1, 'earn', 'Check-in diario');

  IF _bonus > 0 THEN
    INSERT INTO public.ibc_transactions (user_id, amount, type, description)
    VALUES (_uid, _bonus, 'earn', 'Bonus de racha: ' || _streak || ' días');
  END IF;

  RETURN QUERY SELECT w.balance, w.streak_days, 1 + _bonus, _bonus FROM public.ibc_wallets w WHERE w.user_id = _uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ibc_checkin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_checkin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.ibc_wallets (user_id) VALUES (_ref) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.ibc_wallets (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ibc_wallets SET balance = balance + 25 WHERE user_id = _ref;
  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_ref, 25, 'earn', 'Invitación aceptada');

  UPDATE public.ibc_wallets SET balance = balance + 15 WHERE user_id = _uid;
  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, 15, 'earn', 'Bienvenida por invitación');

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
$function$;

CREATE TABLE public.legacy_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email TEXT,
  starting_balance INTEGER NOT NULL DEFAULT 15,
  plan_status TEXT NOT NULL DEFAULT 'free',
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX legacy_members_email_idx ON public.legacy_members (lower(email)) WHERE email IS NOT NULL;

GRANT SELECT ON public.legacy_members TO authenticated;
GRANT ALL ON public.legacy_members TO service_role;
ALTER TABLE public.legacy_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_members_admin_select" ON public.legacy_members
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.legacy_members (display_name, email) VALUES
  ('Samuel Medina', NULL),
  ('Matias Cano', NULL),
  ('Juan Martin Giraldo', NULL),
  ('Juan Simon Gomez', NULL),
  ('Tomas Rivera', NULL),
  ('Simon Rubiano', NULL),
  ('Liz', NULL),
  ('Roa', NULL),
  ('Lu', NULL),
  ('Chiguiro Anonimo', NULL),
  ('Abeja Anonima', NULL),
  ('Juan Sebastian Vargas', NULL),
  ('Juan Sebastian Sarmiento Castillo', NULL),
  ('Santiago Melo', NULL),
  ('Laura Fernanda Cajamarca', NULL),
  ('Sebastian Velandia Acevedo', NULL),
  ('Juan David Veloza Chaves', NULL),
  ('Nelson Diaz Fonseca', NULL),
  ('Ada', NULL),
  ('Jeimy Liliana Galindo', NULL),
  ('xExotic_SparceX', NULL),
  ('Bolivar', NULL),
  ('Juan Sebastian Tovar Vargas', NULL),
  ('Luxyanstore', NULL),
  ('Karen Alejandra David Vasco', NULL),
  ('Sebastian', 'stian7609@gmail.com'),
  ('Leonor Palomo', NULL),
  ('Linder Lopez Rivera', NULL),
  ('Andres', 'anfercoronado@gmail.com'),
  ('Nicolas Mojica', NULL),
  ('Angelica Vega', NULL),
  ('Felipe Avinzano', 'favinzano@gmail.com'),
  ('Alejandro Maldonado', NULL),
  ('Lorenzo Santos', NULL),
  ('Jhonatan Guerrero Sanabria', NULL),
  ('Margarita Rojas', NULL),
  ('Jose Thomas Rodriguez Muños', NULL),
  ('Elemento Flores', NULL),
  ('Javier', 'javier.sanches@gmail.com'),
  ('Helbert Muños', NULL),
  ('Dadd', NULL),
  ('Pinguino Anonimo', NULL),
  ('Samuel Bastidas Cardona', NULL),
  ('Juan Pablo Imon Mendez', NULL),
  ('Valentina Barros', NULL),
  ('Maria Cristina Roque Jaramillo', 'crisrojara2@gmail.com'),
  ('Isabella Rodriguez Roque', 'isaroro2021@gmail.com'),
  ('Amparo Cortazar Jaramillo', NULL),
  ('Francisco', NULL);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _legacy public.legacy_members;
  _balance INT := 15;
BEGIN
  SELECT * INTO _legacy FROM public.legacy_members WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF _legacy.id IS NOT NULL THEN
    _balance := GREATEST(_legacy.starting_balance, 15);
  END IF;

  INSERT INTO public.profiles (id, email, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(_legacy.display_name, NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    upper(substr(replace(NEW.id::text, '-', ''), 1, 8))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.ibc_wallets (user_id, balance, plan_status)
  VALUES (NEW.id, _balance, COALESCE(_legacy.plan_status, 'free'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (NEW.id, _balance, 'earn', CASE WHEN _legacy.id IS NOT NULL THEN 'Bienvenida de regreso 💜' ELSE 'Bono de bienvenida' END);

  IF _legacy.id IS NOT NULL THEN
    UPDATE public.legacy_members SET claimed_by = NEW.id, claimed_at = now() WHERE id = _legacy.id;
  END IF;

  RETURN NEW;
END;
$function$;
