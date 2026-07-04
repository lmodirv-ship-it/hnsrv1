
DROP POLICY IF EXISTS "developers can write service_dependencies" ON public.service_dependencies;
CREATE POLICY sd_write_admin ON public.service_dependencies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sm_write_admin_dev ON public.service_metrics;
CREATE POLICY sm_write_admin ON public.service_metrics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS trn_insert ON public.task_runs;
DROP POLICY IF EXISTS trn_update ON public.task_runs;
CREATE POLICY trn_insert_own ON public.task_runs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR requested_by = auth.uid());
CREATE POLICY trn_update_admin ON public.task_runs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
