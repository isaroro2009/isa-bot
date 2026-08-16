
-- Restrict EXECUTE on SECURITY DEFINER helper functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) TO authenticated, service_role;

-- Tighten permissive INSERT policy on b2b_leads with basic field validation
DROP POLICY IF EXISTS "Anyone can submit lead" ON public.b2b_leads;
CREATE POLICY "Anyone can submit lead"
ON public.b2b_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(trim(company_name)) BETWEEN 1 AND 200
  AND char_length(trim(contact_name)) BETWEEN 1 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(email) <= 320
  AND status = 'new'
);

-- Allow invited users to view their own pending invite by email match
CREATE POLICY "Invitees can view their own invite"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  accepted_at IS NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Allow invited users to mark their own invite as accepted
CREATE POLICY "Invitees can accept their own invite"
ON public.organization_invites
FOR UPDATE
TO authenticated
USING (
  accepted_at IS NULL
  AND expires_at > now()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
