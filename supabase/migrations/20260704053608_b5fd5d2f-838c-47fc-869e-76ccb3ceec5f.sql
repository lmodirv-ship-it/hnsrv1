
CREATE TABLE public.external_schema_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT 'HN Service Hub',
  tables_count INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT,
  last_sync_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  tables_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_schema_mirrors TO authenticated;
GRANT ALL ON public.external_schema_mirrors TO service_role;

ALTER TABLE public.external_schema_mirrors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schema mirrors"
  ON public.external_schema_mirrors
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_external_schema_mirrors_updated_at
  BEFORE UPDATE ON public.external_schema_mirrors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- seed the HN-DB target row
INSERT INTO public.external_schema_mirrors (target_name, target_url, status)
VALUES ('hn-db', 'https://www.hn-dbpro.com', 'pending')
ON CONFLICT (target_name) DO NOTHING;
