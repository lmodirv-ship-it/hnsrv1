
CREATE TABLE IF NOT EXISTS public.service_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  task_type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, capability, task_type)
);
GRANT SELECT ON public.service_capabilities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_capabilities TO authenticated;
GRANT ALL ON public.service_capabilities TO service_role;
ALTER TABLE public.service_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_read_authenticated" ON public.service_capabilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sc_write_admin_dev" ON public.service_capabilities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE TRIGGER trg_service_capabilities_updated_at
  BEFORE UPDATE ON public.service_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_service_capabilities_service ON public.service_capabilities(service_id);
CREATE INDEX IF NOT EXISTS idx_service_capabilities_task_type ON public.service_capabilities(task_type);
CREATE INDEX IF NOT EXISTS idx_service_capabilities_active ON public.service_capabilities(is_active);

-- Compatibility views (aliases to canonical names in the spec)
CREATE OR REPLACE VIEW public.service_registry AS SELECT * FROM public.services;
CREATE OR REPLACE VIEW public.task_runs AS SELECT * FROM public.pipelines;
CREATE OR REPLACE VIEW public.task_steps AS SELECT * FROM public.pipeline_subtasks;
GRANT SELECT ON public.service_registry TO authenticated;
GRANT SELECT ON public.task_runs TO authenticated;
GRANT SELECT ON public.task_steps TO authenticated;
