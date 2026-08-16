-- 1) b2b_leads: anon may only INSERT (public lead form). Remove all other privileges.
REVOKE ALL ON public.b2b_leads FROM anon;
GRANT INSERT ON public.b2b_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.b2b_leads TO authenticated;
GRANT ALL ON public.b2b_leads TO service_role;

-- 2) isaspace storage: scope reads to owner / admin / posts of public profiles
DROP POLICY IF EXISTS "isaspace_read" ON storage.objects;

CREATE POLICY "isaspace_read_scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'isaspace'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.isaspace_posts p
      WHERE p.image_url LIKE '%' || storage.objects.name
        AND private.profile_is_public(p.user_id)
    )
  )
);