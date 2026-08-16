-- 1) IsaSpace posts: quitar lectura anónima (evita correlacionar posts con perfiles)
DROP POLICY IF EXISTS "Anon can read public posts" ON public.isaspace_posts;
REVOKE ALL ON public.isaspace_posts FROM anon;

-- 2) Storage: reemplazar LIKE por coincidencia exacta de ruta
DROP POLICY IF EXISTS "isaspace_read_scoped" ON storage.objects;
CREATE POLICY "isaspace_read_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'isaspace'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.isaspace_posts p
      WHERE p.image_url = storage.objects.name
        AND (storage.foldername(storage.objects.name))[1] = p.user_id::text
        AND private.profile_is_public(p.user_id)
    )
  )
);

-- 3) Invitaciones: sin acceso por solo coincidir email; el token se valida en el servidor
DROP POLICY IF EXISTS "Invitees can view their own invite" ON public.organization_invites;
DROP POLICY IF EXISTS "Invitees can accept their own invite" ON public.organization_invites;