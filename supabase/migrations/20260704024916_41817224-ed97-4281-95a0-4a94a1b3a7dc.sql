
-- 1) network_type on sites and services
DO $$ BEGIN
  CREATE TYPE public.network_type AS ENUM ('internal','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS network_type public.network_type NOT NULL DEFAULT 'external';
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS network_type public.network_type NOT NULL DEFAULT 'external';

-- Any site with a known HN layer is internal by default
UPDATE public.sites SET network_type = 'internal'
  WHERE layer IN ('gateway','orchestrator','app','provider','infrastructure')
    AND network_type = 'external';

UPDATE public.services s SET network_type = 'internal'
  FROM public.sites st
  WHERE s.site_id = st.id AND st.network_type = 'internal' AND s.network_type = 'external';

-- 2) internal_connectors table
CREATE TABLE IF NOT EXISTS public.internal_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL,
  trust_level text NOT NULL DEFAULT 'trusted', -- trusted | verified | restricted
  allowed_internal_services jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of service ids or slugs; empty = all
  connector_status text NOT NULL DEFAULT 'active', -- active | disabled | revoked
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token_prefix)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_connectors TO authenticated;
GRANT ALL ON public.internal_connectors TO service_role;

ALTER TABLE public.internal_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all internal connectors" ON public.internal_connectors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Site owners view their internal connectors" ON public.internal_connectors
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = internal_connectors.site_id AND s.owner_id = auth.uid()));

CREATE TRIGGER internal_connectors_updated
  BEFORE UPDATE ON public.internal_connectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS internal_connectors_site_idx ON public.internal_connectors(site_id);
CREATE INDEX IF NOT EXISTS internal_connectors_prefix_idx ON public.internal_connectors(token_prefix);

-- 3) Mark service_requests with the auth mode used (internal vs external)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS auth_mode text; -- 'internal' | 'external'
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS auth_mode text;
