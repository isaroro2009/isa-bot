DROP POLICY IF EXISTS "Public profiles are viewable by anyone" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT id, username, display_name, avatar_url, headline, bio, location, interests, referral_code, public_profile_enabled
FROM public.profiles
WHERE public_profile_enabled = true;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;