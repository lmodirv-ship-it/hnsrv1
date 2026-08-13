-- 1) Lock down SECURITY DEFINER trigger functions from direct API calls
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sites_block_plaintext_key() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- 2) Restrict platform_settings reads to admins only
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_select" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read platform settings" ON public.platform_settings;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='platform_settings'
      AND cmd IN ('SELECT','ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.platform_settings', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read platform settings"
ON public.platform_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete platform settings"
ON public.platform_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.platform_settings FROM anon;