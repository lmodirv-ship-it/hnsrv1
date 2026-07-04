
DROP POLICY IF EXISTS sc_write_admin_dev ON public.service_capabilities;
CREATE POLICY sc_write_admin ON public.service_capabilities
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS tr_write ON public.task_router;
CREATE POLICY tr_write_admin ON public.task_router
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
