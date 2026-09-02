REVOKE ALL ON FUNCTION public.is_protected_admin(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_protected_admin(uuid) TO service_role;