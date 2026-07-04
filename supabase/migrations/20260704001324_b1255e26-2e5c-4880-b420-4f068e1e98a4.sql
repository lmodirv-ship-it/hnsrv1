
CREATE TABLE public.service_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  depends_on_service_id UUID NULL REFERENCES public.services(id) ON DELETE CASCADE,
  depends_on_system TEXT NULL,
  consumer_site_id UUID NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'depends_on',
  confidence INT NOT NULL DEFAULT 60,
  source TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_deps_relation_chk CHECK (relation_type IN ('depends_on','consumes')),
  CONSTRAINT service_deps_target_chk CHECK (
    depends_on_service_id IS NOT NULL OR depends_on_system IS NOT NULL OR consumer_site_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX service_deps_unique
  ON public.service_dependencies (
    service_id,
    COALESCE(depends_on_service_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(depends_on_system, ''),
    COALESCE(consumer_site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    relation_type
  );

CREATE INDEX service_deps_service_idx ON public.service_dependencies(service_id);
CREATE INDEX service_deps_target_service_idx ON public.service_dependencies(depends_on_service_id);
CREATE INDEX service_deps_consumer_idx ON public.service_dependencies(consumer_site_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_dependencies TO authenticated;
GRANT ALL ON public.service_dependencies TO service_role;

ALTER TABLE public.service_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read service_dependencies"
  ON public.service_dependencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "developers can write service_dependencies"
  ON public.service_dependencies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'admin'));
