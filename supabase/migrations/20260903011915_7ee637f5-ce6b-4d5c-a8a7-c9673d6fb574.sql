CREATE TABLE public.manara_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site text NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  signal_type text NOT NULL DEFAULT 'announcement',
  signal_key text NOT NULL,
  old_value text,
  new_value text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  targets text[] NOT NULL DEFAULT '{}',
  signature text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manara_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_site text NOT NULL,
  target_site text NOT NULL,
  export_id uuid REFERENCES public.manara_exports(id) ON DELETE SET NULL,
  signal_type text NOT NULL DEFAULT 'announcement',
  signal_key text NOT NULL,
  value text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  process_status text NOT NULL DEFAULT 'received',
  reject_reason text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX manara_exports_created_idx ON public.manara_exports (created_at DESC);
CREATE INDEX manara_exports_source_idx ON public.manara_exports (source_site);
CREATE INDEX manara_imports_created_idx ON public.manara_imports (created_at DESC);
CREATE INDEX manara_imports_target_idx ON public.manara_imports (target_site, process_status);

GRANT SELECT ON public.manara_exports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_exports TO authenticated;
GRANT ALL ON public.manara_exports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_imports TO authenticated;
GRANT ALL ON public.manara_imports TO service_role;

ALTER TABLE public.manara_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manara_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manara_exports_public_read" ON public.manara_exports
  FOR SELECT TO anon
  USING (is_public = true AND status = 'delivered' AND signal_type IN ('announcement','domain_change','route_change','status'));

CREATE POLICY "manara_exports_auth_read" ON public.manara_exports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manara_exports_admin_write" ON public.manara_exports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "manara_imports_auth_read" ON public.manara_imports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manara_imports_admin_write" ON public.manara_imports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER manara_exports_set_updated_at BEFORE UPDATE ON public.manara_exports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER manara_imports_set_updated_at BEFORE UPDATE ON public.manara_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.manara_exports REPLICA IDENTITY FULL;
ALTER TABLE public.manara_imports REPLICA IDENTITY FULL;