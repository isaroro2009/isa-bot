
-- Revoke public/anon EXECUTE on SECURITY DEFINER functions and grant only to authenticated where needed
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.award_points(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_points(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ensure_user_points_row(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_points_row(uuid) TO authenticated, service_role;

-- Trigger-only functions: not intended to be called via API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_owner_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
