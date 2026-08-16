DROP POLICY IF EXISTS "Members view their orgs" ON public.organizations;
CREATE POLICY "Members or owner view their orgs"
ON public.organizations FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_org_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
DELETE FROM public.organizations WHERE slug = 'probe-test-123';