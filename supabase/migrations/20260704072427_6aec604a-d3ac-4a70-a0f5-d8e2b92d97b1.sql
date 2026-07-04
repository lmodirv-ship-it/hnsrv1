
-- 1. service_registry: restrict writes to admins only
DROP POLICY IF EXISTS sr_write ON public.service_registry;
CREATE POLICY sr_write_admin ON public.service_registry
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. task_router_rules: restrict writes to admins only
DROP POLICY IF EXISTS trr_write_admin_dev ON public.task_router_rules;
CREATE POLICY trr_write_admin ON public.task_router_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. sites.metadata plaintext keys: move to a separate owner-only secrets table
CREATE TABLE IF NOT EXISTS public.site_secrets (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  hn_hub_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_secrets TO authenticated;
GRANT ALL ON public.site_secrets TO service_role;

ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_secrets_owner_admin_all ON public.site_secrets
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_secrets.site_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_secrets.site_id AND s.owner_id = auth.uid())
  );

-- Migrate existing plaintext keys out of sites.metadata
INSERT INTO public.site_secrets (site_id, hn_hub_key)
SELECT id, metadata->>'hn_hub_key'
FROM public.sites
WHERE metadata ? 'hn_hub_key' AND (metadata->>'hn_hub_key') IS NOT NULL
ON CONFLICT (site_id) DO UPDATE SET hn_hub_key = EXCLUDED.hn_hub_key, updated_at = now();

-- Strip the plaintext key from the public-readable metadata column
UPDATE public.sites SET metadata = metadata - 'hn_hub_key' WHERE metadata ? 'hn_hub_key';

-- Prevent future plaintext key writes into sites.metadata
CREATE OR REPLACE FUNCTION public.sites_block_plaintext_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.metadata ? 'hn_hub_key' THEN
    NEW.metadata := NEW.metadata - 'hn_hub_key';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sites_strip_secret_key ON public.sites;
CREATE TRIGGER sites_strip_secret_key
  BEFORE INSERT OR UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.sites_block_plaintext_key();
