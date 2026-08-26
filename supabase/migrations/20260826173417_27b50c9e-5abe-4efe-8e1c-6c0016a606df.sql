ALTER TABLE public.isaspace_posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'project';

CREATE OR REPLACE FUNCTION public.ibc_reward_isaspace(_kind text)
RETURNS TABLE(balance integer, delta integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today INT;
  _amount INT := 5;
  _bal INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _kind NOT IN ('post', 'feedback') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  PERFORM public.ibc_ensure_wallet();

  SELECT COALESCE(SUM(t.amount), 0) INTO _today
    FROM public.ibc_transactions t
   WHERE t.user_id = _uid
     AND t.type = 'isaspace'
     AND t.created_at >= date_trunc('day', now());

  IF _today >= 25 THEN
    SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id = _uid;
    RETURN QUERY SELECT _bal, 0;
    RETURN;
  END IF;

  UPDATE public.ibc_wallets w SET balance = w.balance + _amount WHERE w.user_id = _uid;
  INSERT INTO public.ibc_transactions (user_id, amount, type, description)
  VALUES (_uid, _amount, 'isaspace',
          CASE WHEN _kind = 'post' THEN 'Publicaste un avance en IsaSpace' ELSE 'Feedback constructivo en IsaSpace' END);

  SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id = _uid;
  RETURN QUERY SELECT _bal, _amount;
END;
$$;

REVOKE ALL ON FUNCTION public.ibc_reward_isaspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ibc_reward_isaspace(text) TO authenticated;