
CREATE TABLE IF NOT EXISTS public.hub_engines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  stage_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hub_engines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_engines TO authenticated;
GRANT ALL ON public.hub_engines TO service_role;

ALTER TABLE public.hub_engines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read engines"
  ON public.hub_engines FOR SELECT
  USING (true);

CREATE POLICY "Admins manage engines"
  ON public.hub_engines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hub_engines_set_updated
  BEFORE UPDATE ON public.hub_engines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.hub_engines (slug, name, description, stage_order, is_enabled) VALUES
  ('request_analyzer', 'Request Analyzer', 'Detects language, intent, entities, and domain of the incoming request.', 1, true),
  ('task_planner',     'Task Planner',     'Turns the analyzed intent into a dependency graph of concrete tasks.', 2, true),
  ('task_dispatcher',  'Task Dispatcher',  'Picks the best provider from the capability registry and executes each task layer.', 3, true),
  ('result_collector', 'Result Collector', 'Aggregates all task outputs, timings and errors into a single collection.', 4, true),
  ('response_builder', 'Response Builder', 'Assembles the final packaged response returned to the caller.', 5, true)
ON CONFLICT (slug) DO NOTHING;
