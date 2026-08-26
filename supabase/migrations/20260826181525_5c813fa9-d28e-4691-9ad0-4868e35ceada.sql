-- 1) Imported public feed: keep read for signed-in users, but expose no non-public data
REVOKE ALL ON public.isaspace_imported FROM anon;
GRANT SELECT ON public.isaspace_imported TO authenticated;
COMMENT ON TABLE public.isaspace_imported IS 'Public fediverso posts (public author handle/avatar/content only). No private data.';

-- 2) Organization members: restrict self-insert strictly to bootstrapping the owner row
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
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m WHERE m.org_id = organization_members.org_id
    )
  )
);