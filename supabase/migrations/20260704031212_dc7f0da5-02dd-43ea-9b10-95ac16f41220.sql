CREATE TABLE public.hub_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  internal_connector_id UUID REFERENCES public.internal_connectors(id) ON DELETE SET NULL,
  auth_mode TEXT NOT NULL DEFAULT 'external',
  requester_site TEXT,
  prompt TEXT NOT NULL,
  language TEXT,
  user_intent TEXT,
  entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_graph JSONB NOT NULL DEFAULT '{"tasks":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  final_response JSONB,
  error TEXT,
  timings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hub_plans_created_at_idx ON public.hub_plans(created_at DESC);
CREATE INDEX hub_plans_status_idx ON public.hub_plans(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_plans TO authenticated;
GRANT ALL ON public.hub_plans TO service_role;

ALTER TABLE public.hub_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and developers can view hub plans"
  ON public.hub_plans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can manage hub plans"
  ON public.hub_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hub_plans_set_updated_at
  BEFORE UPDATE ON public.hub_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pipeline_subtasks
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.hub_plans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS depends_on TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan_step INT,
  ADD COLUMN IF NOT EXISTS engine_stage TEXT,
  ADD COLUMN IF NOT EXISTS task_key TEXT,
  ADD COLUMN IF NOT EXISTS task_type TEXT;

CREATE INDEX IF NOT EXISTS pipeline_subtasks_plan_id_idx ON public.pipeline_subtasks(plan_id);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS services_capabilities_gin ON public.services USING GIN (capabilities);
