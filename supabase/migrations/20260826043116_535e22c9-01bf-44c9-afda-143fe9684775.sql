
DROP POLICY IF EXISTS "Owners/admins add members" ON public.organization_members;
CREATE POLICY "Owners/admins add members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  has_org_role(org_id, auth.uid(), ARRAY['org_owner'::org_role, 'org_admin'::org_role])
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    user_id = auth.uid()
    AND role = 'org_owner'::org_role
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.org_id AND o.owner_id = auth.uid()
    )
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon;
GRANT ALL ON public.referrals TO service_role;
