
DROP VIEW IF EXISTS public.service_registry;
DROP VIEW IF EXISTS public.task_runs;
DROP VIEW IF EXISTS public.task_steps;

CREATE TABLE IF NOT EXISTS public.service_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  domain TEXT,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  service_ref_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  category TEXT,
  service_type TEXT,
  endpoint_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  health TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_registry TO authenticated;
GRANT ALL ON public.service_registry TO service_role;
ALTER TABLE public.service_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_read" ON public.service_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "sr_write" ON public.service_registry FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_service_registry_updated_at BEFORE UPDATE ON public.service_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_service_registry_status ON public.service_registry(status);
CREATE INDEX IF NOT EXISTS idx_service_registry_site ON public.service_registry(site_id);

CREATE TABLE IF NOT EXISTS public.task_router (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  category TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  preferred_service_id UUID REFERENCES public.service_registry(id) ON DELETE SET NULL,
  fallback_service_ids UUID[] NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_router TO authenticated;
GRANT ALL ON public.task_router TO service_role;
ALTER TABLE public.task_router ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_read" ON public.task_router FOR SELECT TO authenticated USING (true);
CREATE POLICY "tr_write" ON public.task_router FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_task_router_updated_at BEFORE UPDATE ON public.task_router
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_task_router_type ON public.task_router(task_type);

CREATE TABLE IF NOT EXISTS public.task_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  router_id UUID REFERENCES public.task_router(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.service_registry(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_runs TO authenticated;
GRANT ALL ON public.task_runs TO service_role;
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trn_read" ON public.task_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "trn_insert" ON public.task_runs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE POLICY "trn_update" ON public.task_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE POLICY "trn_delete" ON public.task_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_task_runs_updated_at BEFORE UPDATE ON public.task_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_task_runs_status ON public.task_runs(status);
CREATE INDEX IF NOT EXISTS idx_task_runs_created ON public.task_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.task_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_run_id UUID NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  service_id UUID REFERENCES public.service_registry(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_steps TO authenticated;
GRANT ALL ON public.task_steps TO service_role;
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tst_read" ON public.task_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "tst_write" ON public.task_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));
CREATE TRIGGER trg_task_steps_updated_at BEFORE UPDATE ON public.task_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_task_steps_run ON public.task_steps(task_run_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_order ON public.task_steps(task_run_id, step_order);

-- Backfill service_registry from existing services
INSERT INTO public.service_registry (name, slug, domain, site_id, service_ref_id, category, endpoint_url, status, health)
SELECT s.name, s.slug, si.base_url, s.site_id, s.id, s.category, s.endpoint_url,
       CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END,
       COALESCE(s.last_health_status, 'unknown')
FROM public.services s
LEFT JOIN public.sites si ON si.id = s.site_id
ON CONFLICT (slug) DO NOTHING;
