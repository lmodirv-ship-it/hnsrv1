DROP POLICY IF EXISTS trn_read ON public.task_runs;
CREATE POLICY trn_read ON public.task_runs FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS tst_read ON public.task_steps;
CREATE POLICY tst_read ON public.task_steps FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.task_runs tr
    WHERE tr.id = task_steps.task_run_id AND tr.requested_by = auth.uid()
  )
);