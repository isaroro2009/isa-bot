-- Helpers
CREATE OR REPLACE FUNCTION public.profile_is_public(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user AND p.public_profile_enabled = true)
$$;

CREATE OR REPLACE FUNCTION public.can_see_post(_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.isaspace_posts p
    WHERE p.id = _post
      AND (p.user_id = auth.uid()
           OR public.profile_is_public(p.user_id)
           OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

-- Public profile reads without granting anon access to the profiles table
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text,
  headline text, bio text, location text, interests text[], referral_code text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.headline, p.bio,
         p.location, p.interests, p.referral_code
  FROM public.profiles p
  WHERE p.public_profile_enabled = true AND lower(p.username) = lower(_username)
$$;

CREATE OR REPLACE FUNCTION public.get_inviter_preview(_code text)
RETURNS TABLE (display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.public_profile_enabled = true AND p.referral_code = upper(_code)
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_inviter_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_is_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_see_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inviter_preview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_post(uuid) TO anon, authenticated;

-- profiles: remove all anonymous access
DROP POLICY IF EXISTS "Anon can view public profiles" ON public.profiles;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- isaspace_posts
DROP POLICY IF EXISTS "Authed can read posts" ON public.isaspace_posts;
CREATE POLICY "Authed can read visible posts" ON public.isaspace_posts
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.profile_is_public(user_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Posts of public profiles are viewable by anyone" ON public.isaspace_posts;
CREATE POLICY "Anon can read public posts" ON public.isaspace_posts
FOR SELECT TO anon
USING (public.profile_is_public(user_id));

-- isaspace_comments
DROP POLICY IF EXISTS "Authed can read comments" ON public.isaspace_comments;
CREATE POLICY "Authed can read visible comments" ON public.isaspace_comments
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_see_post(post_id));

-- isaspace_likes
DROP POLICY IF EXISTS "Authed can read likes" ON public.isaspace_likes;
CREATE POLICY "Authed can read visible likes" ON public.isaspace_likes
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_see_post(post_id));