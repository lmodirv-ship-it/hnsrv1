
-- Add layer + role to sites for HN OS classification
DO $$ BEGIN
  CREATE TYPE public.site_layer AS ENUM ('gateway','orchestrator','app','provider','infrastructure','unclassified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS layer public.site_layer NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS role text;

CREATE INDEX IF NOT EXISTS sites_layer_idx ON public.sites(layer);

-- Backfill layer from category heuristics
UPDATE public.sites SET layer = 'provider'
  WHERE layer = 'unclassified' AND category IN ('ai','createur_media','chat');

UPDATE public.sites SET layer = 'infrastructure'
  WHERE layer = 'unclassified' AND category IN ('database');

UPDATE public.sites SET layer = 'app'
  WHERE layer = 'unclassified' AND category IN ('driver','carwash_print','clinic','immo','finance','adkhar','groupe');

-- Store the last full journey path for a request (User → Site → TVCC → Hub → Provider → …)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS gateway_site text,
  ADD COLUMN IF NOT EXISTS journey_path jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS gateway_site text,
  ADD COLUMN IF NOT EXISTS journey_path jsonb NOT NULL DEFAULT '[]'::jsonb;
