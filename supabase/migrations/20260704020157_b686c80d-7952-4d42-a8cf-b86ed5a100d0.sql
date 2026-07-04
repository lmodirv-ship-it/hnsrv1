
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.api_clients(id) ON DELETE SET NULL,
  requester_site TEXT,
  intent TEXT NOT NULL,
  prompt TEXT,
  input_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  subtasks_total INT NOT NULL DEFAULT 0,
  subtasks_done INT NOT NULL DEFAULT 0,
  final_package JSONB,
  error TEXT,
  latency_ms INT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipelines_status ON public.pipelines(status);
CREATE INDEX idx_pipelines_created_at ON public.pipelines(created_at DESC);
CREATE INDEX idx_pipelines_requester ON public.pipelines(requester_site);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipelines TO authenticated;
GRANT ALL ON public.pipelines TO service_role;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read pipelines"
  ON public.pipelines FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "authenticated can insert pipelines"
  ON public.pipelines FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "admins can manage pipelines"
  ON public.pipelines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pipelines_set_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.pipeline_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  task_order INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  intent TEXT,
  assigned_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  assigned_provider_site TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_payload JSONB,
  output_payload JSONB,
  error TEXT,
  status_code INT,
  attempts INT NOT NULL DEFAULT 0,
  latency_ms INT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtasks_pipeline ON public.pipeline_subtasks(pipeline_id, task_order);
CREATE INDEX idx_subtasks_status ON public.pipeline_subtasks(status);
CREATE INDEX idx_subtasks_provider ON public.pipeline_subtasks(assigned_provider_site);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_subtasks TO authenticated;
GRANT ALL ON public.pipeline_subtasks TO service_role;
ALTER TABLE public.pipeline_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read subtasks"
  ON public.pipeline_subtasks FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "admins can manage subtasks"
  ON public.pipeline_subtasks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER subtasks_set_updated_at
  BEFORE UPDATE ON public.pipeline_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
