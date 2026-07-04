-- Enum types for the registry
DO $$ BEGIN
  CREATE TYPE public.capability_status AS ENUM ('online', 'degraded', 'offline', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capability_source AS ENUM ('manifest', 'manual', 'inferred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) site_capabilities: canonical (service, task_type) rows
CREATE TABLE public.site_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.capability_status NOT NULL DEFAULT 'unknown',
  source public.capability_source NOT NULL DEFAULT 'manifest',
  last_probed_at TIMESTAMPTZ,
  last_ok_at TIMESTAMPTZ,
  probe_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, task_type)
);

CREATE INDEX site_capabilities_task_type_idx ON public.site_capabilities(task_type);
CREATE INDEX site_capabilities_site_idx ON public.site_capabilities(site_id);
CREATE INDEX site_capabilities_status_idx ON public.site_capabilities(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_capabilities TO authenticated;
GRANT ALL ON public.site_capabilities TO service_role;

ALTER TABLE public.site_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and developers can view capabilities"
  ON public.site_capabilities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can manage capabilities"
  ON public.site_capabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_capabilities_set_updated_at
  BEFORE UPDATE ON public.site_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) discovery_runs: one row per discovery pass
CREATE TABLE public.discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE, -- null = all sites
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  services_found INT NOT NULL DEFAULT 0,
  capabilities_found INT NOT NULL DEFAULT 0,
  errors_count INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX discovery_runs_started_at_idx ON public.discovery_runs(started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_runs TO authenticated;
GRANT ALL ON public.discovery_runs TO service_role;

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and developers can view discovery runs"
  ON public.discovery_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can manage discovery runs"
  ON public.discovery_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) sites.manifest_path so Hub knows where to fetch each site's manifest
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS manifest_path TEXT NOT NULL DEFAULT '/.well-known/hn-services';

-- 4) pipeline_subtasks.capability_id so we can trace which capability was used
ALTER TABLE public.pipeline_subtasks
  ADD COLUMN IF NOT EXISTS capability_id UUID REFERENCES public.site_capabilities(id) ON DELETE SET NULL;
