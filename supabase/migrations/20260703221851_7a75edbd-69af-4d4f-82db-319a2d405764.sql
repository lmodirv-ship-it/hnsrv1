
CREATE TABLE public.hub_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub TEXT NOT NULL UNIQUE CHECK (hub IN ('tvcc','hn_db','hn_cloud','hn_core')),
  base_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_status TEXT,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_integrations TO authenticated;
GRANT ALL ON public.hub_integrations TO service_role;

ALTER TABLE public.hub_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view hub integrations"
  ON public.hub_integrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage hub integrations"
  ON public.hub_integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hub_integrations_set_updated_at
  BEFORE UPDATE ON public.hub_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.hub_integrations (hub) VALUES ('tvcc'),('hn_db'),('hn_cloud'),('hn_core')
  ON CONFLICT (hub) DO NOTHING;

-- Track hub-side registrations per site
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS tvcc_id TEXT,
  ADD COLUMN IF NOT EXISTS hn_db_id TEXT,
  ADD COLUMN IF NOT EXISTS hn_cloud_id TEXT,
  ADD COLUMN IF NOT EXISTS integration_log JSONB NOT NULL DEFAULT '[]'::jsonb;
