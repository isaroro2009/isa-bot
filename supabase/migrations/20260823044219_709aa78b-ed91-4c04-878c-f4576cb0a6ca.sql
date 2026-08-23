-- 1) Refunds tied to a real prior spend
ALTER TABLE public.ibc_transactions ADD COLUMN IF NOT EXISTS refund_of UUID REFERENCES public.ibc_transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ibc_transactions_refund_of_uidx ON public.ibc_transactions (refund_of) WHERE refund_of IS NOT NULL;

DROP FUNCTION IF EXISTS public.ibc_spend(integer, text);
CREATE FUNCTION public.ibc_spend(_amount integer, _reason text)
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 100 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT w.balance INTO _current FROM public.ibc_wallets w WHERE w.user_id = _uid FOR UPDATE;
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
GRANT EXECUTE ON FUNCTION public.ibc_spend(integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ibc_refund(_tx_id uuid)
 RETURNS TABLE(balance integer, refunded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _amount INT;
  _bal INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _tx_id IS NULL THEN RAISE EXCEPTION 'invalid transaction'; END IF;

  SELECT -t.amount INTO _amount
    FROM public.ibc_transactions t
   WHERE t.id = _tx_id
     AND t.user_id = _uid
     AND t.type = 'spend'
     AND t.created_at > now() - interval '1 day'
   FOR UPDATE;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'refund_not_allowed'; END IF;

  IF EXISTS (SELECT 1 FROM public.ibc_transactions r WHERE r.refund_of = _tx_id) THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;

  UPDATE public.ibc_wallets w SET balance = w.balance + _amount WHERE w.user_id = _uid;
  INSERT INTO public.ibc_transactions (user_id, amount, type, description, refund_of)
  VALUES (_uid, _amount, 'refund', 'Reembolso', _tx_id);

  SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id = _uid;
  RETURN QUERY SELECT _bal, _amount;
END;
$function$;

REVOKE ALL ON FUNCTION public.ibc_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_refund(uuid) TO authenticated, service_role;

-- 2) Lock down SECURITY DEFINER functions signed-in users must not call
REVOKE ALL ON FUNCTION public.ibc_grant(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ibc_grant(integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.redeem_reward(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text) TO service_role;

-- 3) Prevent self-granted elevated org roles
DROP POLICY IF EXISTS "Owners/admins add members" ON public.organization_members;
CREATE POLICY "Owners/admins add members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[])
    OR public.has_role(auth.uid(), 'admin')
    OR (user_id = auth.uid() AND role = 'org_member'::public.org_role)
  );