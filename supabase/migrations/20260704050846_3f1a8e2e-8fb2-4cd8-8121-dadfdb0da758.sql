
-- 1) websites_services: mapping of services per site
CREATE TABLE IF NOT EXISTS public.websites_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  path TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, service_name)
);
GRANT SELECT ON public.websites_services TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.websites_services TO authenticated;
GRANT ALL ON public.websites_services TO service_role;
ALTER TABLE public.websites_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_read_authenticated" ON public.websites_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_write_admin_dev" ON public.websites_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE TRIGGER trg_websites_services_updated_at
  BEFORE UPDATE ON public.websites_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_websites_services_site ON public.websites_services(site_id);
CREATE INDEX IF NOT EXISTS idx_websites_services_service ON public.websites_services(service_id);

-- 2) service_metrics: rolling stats per service
CREATE TABLE IF NOT EXISTS public.service_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ,
  requests_total INTEGER NOT NULL DEFAULT 0,
  requests_success INTEGER NOT NULL DEFAULT 0,
  requests_failed INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER NOT NULL DEFAULT 0,
  p95_duration_ms INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_metrics TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_metrics TO authenticated;
GRANT ALL ON public.service_metrics TO service_role;
ALTER TABLE public.service_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_read_authenticated" ON public.service_metrics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm_write_admin_dev" ON public.service_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE TRIGGER trg_service_metrics_updated_at
  BEFORE UPDATE ON public.service_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_service_metrics_service ON public.service_metrics(service_id);
CREATE INDEX IF NOT EXISTS idx_service_metrics_window ON public.service_metrics(window_start DESC);

-- 3) task_router_rules: routing rules for task dispatch
CREATE TABLE IF NOT EXISTS public.task_router_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  category TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  preferred_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  fallback_service_ids UUID[] NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_router_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_router_rules TO authenticated;
GRANT ALL ON public.task_router_rules TO service_role;
ALTER TABLE public.task_router_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trr_read_authenticated" ON public.task_router_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trr_write_admin_dev" ON public.task_router_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE TRIGGER trg_task_router_rules_updated_at
  BEFORE UPDATE ON public.task_router_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_task_router_rules_type ON public.task_router_rules(task_type);
CREATE INDEX IF NOT EXISTS idx_task_router_rules_active ON public.task_router_rules(is_active);
