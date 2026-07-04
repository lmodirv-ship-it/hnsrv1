
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS requester_site   text,
  ADD COLUMN IF NOT EXISTS provider_site    text,
  ADD COLUMN IF NOT EXISTS service_intent   text,
  ADD COLUMN IF NOT EXISTS request_payload  jsonb,
  ADD COLUMN IF NOT EXISTS routing_decision jsonb,
  ADD COLUMN IF NOT EXISTS execution_status text,
  ADD COLUMN IF NOT EXISTS response_payload jsonb,
  ADD COLUMN IF NOT EXISTS fallback_used    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempts         integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS service_requests_status_idx     ON public.service_requests(execution_status);
CREATE INDEX IF NOT EXISTS service_requests_requester_idx  ON public.service_requests(requester_site);
CREATE INDEX IF NOT EXISTS service_requests_provider_idx   ON public.service_requests(provider_site);

CREATE TABLE IF NOT EXISTS public.fallback_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_pattern text NOT NULL,
  primary_service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  fallback_service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fallback_rules TO authenticated;
GRANT ALL ON public.fallback_rules TO service_role;
ALTER TABLE public.fallback_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fallback rules" ON public.fallback_rules;
CREATE POLICY "Admins manage fallback rules" ON public.fallback_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated read fallback rules" ON public.fallback_rules;
CREATE POLICY "Authenticated read fallback rules" ON public.fallback_rules
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_fallback_updated ON public.fallback_rules;
CREATE TRIGGER trg_fallback_updated BEFORE UPDATE ON public.fallback_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
