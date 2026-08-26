DROP POLICY IF EXISTS academy_lessons_read ON public.academy_lessons;
DROP POLICY IF EXISTS academy_tracks_read ON public.academy_tracks;

CREATE OR REPLACE FUNCTION public.is_premium_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.is_premium = true
      AND (p.premium_expires_at IS NULL OR p.premium_expires_at > now())
  ) OR EXISTS (
    SELECT 1 FROM public.ibc_subscriptions s
    WHERE s.user_id = _user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_premium_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_premium_user(uuid) TO authenticated, service_role;

CREATE POLICY academy_tracks_read ON public.academy_tracks
FOR SELECT TO authenticated
USING (premium = false OR public.is_premium_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY academy_lessons_read ON public.academy_lessons
FOR SELECT TO authenticated
USING (premium = false OR public.is_premium_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));