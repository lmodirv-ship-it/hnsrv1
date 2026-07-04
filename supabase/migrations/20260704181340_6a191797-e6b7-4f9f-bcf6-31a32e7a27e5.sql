
DROP POLICY IF EXISTS "Anyone authenticated can read agents" ON public.hn_agents;
CREATE POLICY "Admins can read agents"
  ON public.hn_agents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read agent runs" ON public.hn_agent_runs;
CREATE POLICY "Admins can read agent runs"
  ON public.hn_agent_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
