-- 1) La vista deja de ejecutarse con los permisos de su creador
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- 2) Acceso anónimo estrictamente por columna sobre profiles
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, avatar_url, headline, bio, location,
  interests, referral_code, public_profile_enabled
) ON public.profiles TO anon;

DROP POLICY IF EXISTS "Anon can view public profiles" ON public.profiles;
CREATE POLICY "Anon can view public profiles"
ON public.profiles
FOR SELECT
TO anon
USING (public_profile_enabled = true);

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3) Posts: anon solo columnas necesarias, y solo de perfiles públicos
REVOKE ALL ON public.isaspace_posts FROM anon;
GRANT SELECT (id, user_id, content, image_url, created_at) ON public.isaspace_posts TO anon;