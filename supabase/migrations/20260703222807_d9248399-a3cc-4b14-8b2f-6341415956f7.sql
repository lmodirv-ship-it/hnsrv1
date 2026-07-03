
DROP POLICY IF EXISTS "Admins can view hub integrations" ON public.hub_integrations;
DROP POLICY IF EXISTS "Admins can manage hub integrations" ON public.hub_integrations;

CREATE POLICY "Authenticated can view hub integrations"
  ON public.hub_integrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update hub integrations"
  ON public.hub_integrations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
