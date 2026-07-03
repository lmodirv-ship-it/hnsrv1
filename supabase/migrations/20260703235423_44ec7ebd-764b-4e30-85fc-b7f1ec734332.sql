
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS confidence_score numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS api_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS discovered_from_job_id uuid,
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_status text;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_approval_status_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_approval_status_check
  CHECK (approval_status IN ('approved','pending','rejected'));

CREATE INDEX IF NOT EXISTS services_approval_idx ON public.services(approval_status);
CREATE INDEX IF NOT EXISTS services_site_idx ON public.services(site_id);
