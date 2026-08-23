ALTER TABLE public.ibc_wallets ADD COLUMN IF NOT EXISTS unlimited_coins boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ibc_spend(_amount integer, _reason text)
 RETURNS TABLE(balance integer, spent integer, tx_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _current INT;
  _bal INT;
  _tx UUID;
  _unlimited BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 100 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.balance, w.unlimited_coins INTO _current, _unlimited
    FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;

  IF _unlimited THEN
    SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id = _uid;
    RETURN QUERY SELECT _bal, 0, NULL::uuid;
    RETURN;
  END IF;

  IF _current < _amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  IF _amount > 0 THEN
    UPDATE public.ibc_wallets w SET balance = w.balance - _amount WHERE w.user_id = _uid;
    INSERT INTO public.ibc_transactions (user_id, amount, type, description)
    VALUES (_uid, -_amount, 'spend', COALESCE(left(_reason, 120), 'Acción'))
    RETURNING id INTO _tx;
  END IF;

  SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id = _uid;
  RETURN QUERY SELECT _bal, _amount, _tx;
END;
$function$;

REVOKE ALL ON FUNCTION public.ibc_spend(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_spend(integer, text) TO authenticated;