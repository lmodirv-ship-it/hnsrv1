
CREATE TABLE public.hn_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_number SERIAL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  site_name TEXT,
  service_name TEXT,
  role TEXT NOT NULL DEFAULT 'generic',
  description TEXT,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  tools TEXT[] NOT NULL DEFAULT '{}',
  script_lang TEXT NOT NULL DEFAULT 'python',
  script_content TEXT,
  runtime_path TEXT DEFAULT 'd:\\hn',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  runs_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, service_id)
);

CREATE INDEX hn_agents_site_idx ON public.hn_agents(site_id);
CREATE INDEX hn_agents_service_idx ON public.hn_agents(service_id);
CREATE INDEX hn_agents_active_idx ON public.hn_agents(is_active);

GRANT SELECT ON public.hn_agents TO authenticated;
GRANT ALL ON public.hn_agents TO service_role;

ALTER TABLE public.hn_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read agents"
  ON public.hn_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage agents"
  ON public.hn_agents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hn_agents_updated_at
  BEFORE UPDATE ON public.hn_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.hn_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.hn_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hn_agent_runs_agent_idx ON public.hn_agent_runs(agent_id, started_at DESC);

GRANT SELECT ON public.hn_agent_runs TO authenticated;
GRANT ALL ON public.hn_agent_runs TO service_role;

ALTER TABLE public.hn_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read agent runs"
  ON public.hn_agent_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage agent runs"
  ON public.hn_agent_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
