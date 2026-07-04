
-- task_steps: admin or owner of parent task_run
DROP POLICY IF EXISTS tst_write ON public.task_steps;
CREATE POLICY tst_write_admin_or_owner ON public.task_steps
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.task_runs r WHERE r.id = task_steps.task_run_id AND r.requested_by = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.task_runs r WHERE r.id = task_steps.task_run_id AND r.requested_by = auth.uid())
  );

-- websites_services: admin-only writes
DROP POLICY IF EXISTS ws_write_admin_dev ON public.websites_services;
CREATE POLICY ws_write_admin ON public.websites_services
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- hub_plans: admin-only reads (contains prompts and AI outputs for all users)
DROP POLICY IF EXISTS "Admins and developers can view hub plans" ON public.hub_plans;
CREATE POLICY hub_plans_admin_read ON public.hub_plans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
