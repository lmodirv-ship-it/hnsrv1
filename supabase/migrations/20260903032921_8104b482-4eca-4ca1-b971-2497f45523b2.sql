CREATE TABLE IF NOT EXISTS public.group_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('import','export')),
  status text NOT NULL DEFAULT 'pending',
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  exported integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_sync_runs_created_idx ON public.group_sync_runs (created_at DESC);
GRANT SELECT ON public.group_sync_runs TO authenticated;
GRANT ALL ON public.group_sync_runs TO service_role;
ALTER TABLE public.group_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_runs_read_auth" ON public.group_sync_runs;
CREATE POLICY "sync_runs_read_auth" ON public.group_sync_runs FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.task_center_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_site text NOT NULL,
  requester_code text,
  service_intent text NOT NULL,
  provider_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  provider_site text,
  provider_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','routed','dispatched','completed','failed','returned')),
  origin text NOT NULL DEFAULT 'direct',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  callback_url text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_center_status_idx ON public.task_center_tasks (status);
CREATE INDEX IF NOT EXISTS task_center_created_idx ON public.task_center_tasks (created_at DESC);
GRANT SELECT ON public.task_center_tasks TO authenticated;
GRANT ALL ON public.task_center_tasks TO service_role;
ALTER TABLE public.task_center_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_center_read_auth" ON public.task_center_tasks;
CREATE POLICY "task_center_read_auth" ON public.task_center_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_center_admin_write" ON public.task_center_tasks;
CREATE POLICY "task_center_admin_write" ON public.task_center_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP TRIGGER IF EXISTS trg_task_center_updated_at ON public.task_center_tasks;
CREATE TRIGGER trg_task_center_updated_at BEFORE UPDATE ON public.task_center_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();