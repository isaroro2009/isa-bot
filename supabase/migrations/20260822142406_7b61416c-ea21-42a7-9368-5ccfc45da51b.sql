-- 1) Lock down SECURITY DEFINER helpers: no public/anon execute anywhere
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.award_points(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_reward(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_user_points_row(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_owner_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_applications_guard() FROM PUBLIC, anon, authenticated;

-- points row bootstrap is now server-side only; make sure it can never touch another user
CREATE OR REPLACE FUNCTION public.ensure_user_points_row(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.user_points (user_id, points, lifetime_points)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.ensure_user_points_row(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_points_row(uuid) TO service_role;

-- 2) b2b_leads: global admins may delete leads (e.g. GDPR / spam removal)
DROP POLICY IF EXISTS "Global admins delete leads" ON public.b2b_leads;
CREATE POLICY "Global admins delete leads"
ON public.b2b_leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
GRANT DELETE ON public.b2b_leads TO authenticated;

-- 3) email_log: reads for global admins only, writes strictly server-side
REVOKE ALL ON TABLE public.email_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.email_log TO authenticated;
GRANT ALL ON TABLE public.email_log TO service_role;
DROP POLICY IF EXISTS "No client writes to email log" ON public.email_log;
CREATE POLICY "No client writes to email log"
ON public.email_log FOR INSERT TO authenticated
WITH CHECK (false);

-- 4) organization_invites: tokens only visible to that org's owners/admins
DROP POLICY IF EXISTS "Owners/admins view invites" ON public.organization_invites;
CREATE POLICY "Owners/admins view invites"
ON public.organization_invites FOR SELECT TO authenticated
USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::org_role[]));