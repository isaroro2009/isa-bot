CREATE OR REPLACE FUNCTION public.__tmp_apply_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.__tmp_apply_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__tmp_apply_sql(text) TO service_role;