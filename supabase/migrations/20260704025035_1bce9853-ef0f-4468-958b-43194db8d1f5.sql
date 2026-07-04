
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS internal_connector_id uuid REFERENCES public.internal_connectors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS service_requests_internal_connector_idx ON public.service_requests(internal_connector_id);

ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS internal_connector_id uuid REFERENCES public.internal_connectors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pipelines_internal_connector_idx ON public.pipelines(internal_connector_id);
