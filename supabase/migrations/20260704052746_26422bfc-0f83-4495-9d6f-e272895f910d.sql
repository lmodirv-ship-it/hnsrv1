
-- hub_integrations: admin-only read
DROP POLICY IF EXISTS "Authenticated can view hub integrations" ON public.hub_integrations;
CREATE POLICY "Admins can view hub integrations" ON public.hub_integrations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- pipelines: owner/client/admin only
DROP POLICY IF EXISTS "authenticated can read pipelines" ON public.pipelines;
CREATE POLICY "owners or admins read pipelines" ON public.pipelines
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR client_id IN (SELECT id FROM public.api_clients WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- pipeline_subtasks: scoped through parent pipeline ownership
DROP POLICY IF EXISTS "authenticated can read subtasks" ON public.pipeline_subtasks;
CREATE POLICY "owners or admins read subtasks" ON public.pipeline_subtasks
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_subtasks.pipeline_id
        AND (
          p.owner_id = auth.uid()
          OR p.client_id IN (SELECT id FROM public.api_clients WHERE owner_id = auth.uid())
        )
    )
  );

-- task_runs: requester/admin/developer only
DROP POLICY IF EXISTS "trn_read" ON public.task_runs;
CREATE POLICY "trn_read" ON public.task_runs
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

-- task_steps: scoped through parent task_run
DROP POLICY IF EXISTS "tst_read" ON public.task_steps;
CREATE POLICY "tst_read" ON public.task_steps
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR EXISTS (
      SELECT 1 FROM public.task_runs r
      WHERE r.id = task_steps.task_run_id AND r.requested_by = auth.uid()
    )
  );

-- internal_connectors: hide token_hash column from authenticated (service_role still has ALL)
REVOKE SELECT (token_hash) ON public.internal_connectors FROM authenticated;
REVOKE SELECT (token_hash) ON public.internal_connectors FROM anon;
