CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.profile_is_public(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user AND p.public_profile_enabled = true)
$$;

CREATE OR REPLACE FUNCTION private.can_see_post(_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.isaspace_posts p
    WHERE p.id = _post
      AND (p.user_id = auth.uid()
           OR private.profile_is_public(p.user_id)
           OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

GRANT EXECUTE ON FUNCTION private.profile_is_public(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_see_post(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Authed can read visible posts" ON public.isaspace_posts;
DROP POLICY IF EXISTS "Anon can read public posts" ON public.isaspace_posts;
DROP POLICY IF EXISTS "Authed can read visible comments" ON public.isaspace_comments;
DROP POLICY IF EXISTS "Authed can read visible likes" ON public.isaspace_likes;

CREATE POLICY "Authed can read visible posts" ON public.isaspace_posts
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.profile_is_public(user_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can read public posts" ON public.isaspace_posts
FOR SELECT TO anon
USING (private.profile_is_public(user_id));

CREATE POLICY "Authed can read visible comments" ON public.isaspace_comments
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.can_see_post(post_id));

CREATE POLICY "Authed can read visible likes" ON public.isaspace_likes
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.can_see_post(post_id));

DROP FUNCTION IF EXISTS public.profile_is_public(uuid);
DROP FUNCTION IF EXISTS public.can_see_post(uuid);
DROP FUNCTION IF EXISTS public.get_public_profile(text);
DROP FUNCTION IF EXISTS public.get_inviter_preview(text);