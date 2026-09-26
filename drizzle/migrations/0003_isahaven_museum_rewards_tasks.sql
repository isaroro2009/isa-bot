CREATE TABLE public.task_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_ref text NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_ref)
);
GRANT SELECT ON public.task_rewards TO authenticated;
GRANT ALL ON public.task_rewards TO service_role;
ALTER TABLE public.task_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own task rewards" ON public.task_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ibc_task_reward(_task_ref text, _priority text)
RETURNS TABLE(balance integer, delta integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _amt int; _today int; _bal int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _task_ref IS NULL OR length(_task_ref) > 80 THEN RAISE EXCEPTION 'invalid task'; END IF;
  _amt := CASE WHEN _priority = 'high' THEN 50 WHEN _priority = 'medium' THEN 30 ELSE 20 END;
  PERFORM public.ibc_ensure_wallet();
  SELECT COALESCE(SUM(amount),0) INTO _today FROM public.task_rewards WHERE user_id = _uid AND created_at >= date_trunc('day', now());
  IF _today + _amt > 200 OR EXISTS (SELECT 1 FROM public.task_rewards WHERE user_id=_uid AND task_ref=_task_ref) THEN
    SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id=_uid;
    RETURN QUERY SELECT _bal, 0; RETURN;
  END IF;
  INSERT INTO public.task_rewards(user_id, task_ref, amount) VALUES (_uid, _task_ref, _amt);
  UPDATE public.ibc_wallets w SET balance = w.balance + _amt WHERE w.user_id=_uid RETURNING w.balance INTO _bal;
  INSERT INTO public.ibc_transactions(user_id, amount, type, description) VALUES (_uid, _amt, 'earn', 'Tarea completada');
  RETURN QUERY SELECT _bal, _amt;
END; $$;

CREATE TABLE public.museum_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  issuer text NOT NULL DEFAULT '',
  image_data text NOT NULL,
  ai_verdict text NOT NULL DEFAULT '',
  valid boolean NOT NULL DEFAULT false,
  reward integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.museum_certificates TO authenticated;
GRANT ALL ON public.museum_certificates TO service_role;
ALTER TABLE public.museum_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own or valid certs" ON public.museum_certificates FOR SELECT TO authenticated USING (auth.uid() = user_id OR valid = true);
CREATE POLICY "delete own certs" ON public.museum_certificates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.reward_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🎁',
  sponsor text NOT NULL DEFAULT '',
  cost integer NOT NULL CHECK (cost > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_items TO authenticated;
GRANT ALL ON public.reward_items TO service_role;
ALTER TABLE public.reward_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active rewards" ON public.reward_items FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reward_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.reward_items(id) ON DELETE CASCADE,
  code text NOT NULL,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_codes TO authenticated;
GRANT ALL ON public.reward_codes TO service_role;
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own redeemed codes" ON public.reward_codes FOR SELECT TO authenticated USING (redeemed_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.reward_stock()
RETURNS TABLE(item_id uuid, available bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT item_id, COUNT(*) FROM public.reward_codes WHERE redeemed_by IS NULL GROUP BY item_id
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward_code(_item uuid)
RETURNS TABLE(code text, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _cost int; _bal int; _cid uuid; _code text; _title text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT cost, title INTO _cost, _title FROM public.reward_items WHERE id=_item AND active;
  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  PERFORM public.ibc_ensure_wallet();
  SELECT w.balance INTO _bal FROM public.ibc_wallets w WHERE w.user_id=_uid FOR UPDATE;
  IF _bal < _cost THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  SELECT c.id, c.code INTO _cid, _code FROM public.reward_codes c WHERE c.item_id=_item AND c.redeemed_by IS NULL ORDER BY c.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _cid IS NULL THEN RAISE EXCEPTION 'out_of_stock'; END IF;
  UPDATE public.reward_codes SET redeemed_by=_uid, redeemed_at=now() WHERE id=_cid;
  UPDATE public.ibc_wallets w SET balance = w.balance - _cost WHERE w.user_id=_uid RETURNING w.balance INTO _bal;
  INSERT INTO public.ibc_transactions(user_id, amount, type, description) VALUES (_uid, -_cost, 'spend', left('Canje: ' || _title, 120));
  RETURN QUERY SELECT _code, _bal;
END; $$;