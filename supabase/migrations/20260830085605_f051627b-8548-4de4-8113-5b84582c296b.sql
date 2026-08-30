CREATE TABLE public.group_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][0-9]{6}$'),
  service_number integer NOT NULL UNIQUE,
  service_name text NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  site_url text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','connected','revoked')),
  last_signal_at timestamptz,
  last_tvcc_status text,
  last_tvcc_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_identifier_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_id uuid NOT NULL REFERENCES public.group_identifiers(id) ON DELETE CASCADE,
  origin text,
  ip_hash text,
  user_agent text,
  forwarded_to_tvcc boolean NOT NULL DEFAULT false,
  tvcc_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_identifier_signals_identifier ON public.group_identifier_signals(identifier_id, created_at DESC);

GRANT SELECT ON public.group_identifiers TO authenticated;
GRANT ALL ON public.group_identifiers TO service_role;
GRANT SELECT ON public.group_identifier_signals TO authenticated;
GRANT ALL ON public.group_identifier_signals TO service_role;

ALTER TABLE public.group_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_identifier_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read group identifiers"
  ON public.group_identifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage group identifiers"
  ON public.group_identifiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read identifier signals"
  ON public.group_identifier_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage identifier signals"
  ON public.group_identifier_signals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_group_identifiers_updated_at
  BEFORE UPDATE ON public.group_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_group_identifier()
RETURNS TABLE(code text, service_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('group_identifier_seq'));
  SELECT COALESCE(MAX(gi.service_number), 0) + 1 INTO n FROM public.group_identifiers gi;
  RETURN QUERY SELECT 'H' || lpad(n::text, 6, '0'), n;
END;
$$;

REVOKE ALL ON FUNCTION public.next_group_identifier() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_group_identifier() TO service_role;