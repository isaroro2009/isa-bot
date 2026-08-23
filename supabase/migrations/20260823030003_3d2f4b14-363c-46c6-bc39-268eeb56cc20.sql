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
  _bal INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.last_checkin_at, w.streak_days INTO _last, _streak
  FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;

  IF _last IS NOT NULL AND (_last AT TIME ZONE 'UTC')::date >= _today THEN
    SELECT w.balance, w.streak_days INTO _bal, _streak
    FROM public.ibc_wallets w WHERE w.user_id = _uid;
    RETURN QUERY SELECT _bal, _streak, 0, 0;
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

  UPDATE public.ibc_wallets w
     SET balance = w.balance + 1 + _bonus,
         streak_days = _streak,
         last_checkin_at = now()
   WHERE w.user_id = _uid
   RETURNING w.balance INTO _bal;

  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, 1, 'earn', 'Check-in diario');

  IF _bonus > 0 THEN
    INSERT INTO public.ibc_transactions (user_id, amount, type, description)
    VALUES (_uid, _bonus, 'earn', 'Bonus de racha: ' || _streak || ' dias');
  END IF;

  RETURN QUERY SELECT _bal, _streak, 1 + _bonus, _bonus;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ibc_checkin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_checkin() TO authenticated, service_role;