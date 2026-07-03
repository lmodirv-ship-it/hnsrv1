
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS endpoint_url TEXT,
  ADD COLUMN IF NOT EXISTS gateway_url TEXT,
  ADD COLUMN IF NOT EXISTS routing_mode TEXT NOT NULL DEFAULT 'auto' CHECK (routing_mode IN ('direct','via_tvcc','auto')),
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_per_min INTEGER NOT NULL DEFAULT 60;
