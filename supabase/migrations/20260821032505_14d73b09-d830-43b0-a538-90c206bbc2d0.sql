-- 1) Lock down SECURITY DEFINER / helper functions from direct client execution
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_applications_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ensure_user_points_row: keep callable but restrict to the caller's own row
CREATE OR REPLACE FUNCTION public.ensure_user_points_row(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF auth.uid() IS NULL AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.user_points (user_id, points, lifetime_points)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

-- 2) email_log: explicitly deny all direct client access (writes happen via service role only)
REVOKE ALL ON TABLE public.email_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.email_log TO authenticated; -- admin-only SELECT policy still applies
GRANT ALL ON TABLE public.email_log TO service_role;

-- 3) organization_invites: allow org owners/admins to update their org's invites
CREATE POLICY "Owners/admins update invites"
ON public.organization_invites
FOR UPDATE
TO authenticated
USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::org_role[]))
WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::org_role[]));

-- 4) isaspace storage: owner-scoped UPDATE policy consistent with insert/delete
CREATE POLICY "isaspace_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'isaspace' AND owner = auth.uid())
WITH CHECK (bucket_id = 'isaspace' AND owner = auth.uid());