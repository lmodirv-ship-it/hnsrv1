
INSERT INTO public.sites (id, name, slug, base_url, layer, network_type, metadata)
VALUES (
  '00000000-0000-0000-0000-0000000c0001',
  'HN Service Hub Console',
  'hub-console',
  'https://console.hn-service-hub.internal',
  'orchestrator',
  'internal',
  '{"kind":"hub_console","system":true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.internal_connectors (
  id, site_id, name, token_prefix, token_hash,
  trust_level, allowed_internal_services, connector_status
)
SELECT
  '00000000-0000-0000-0000-0000000c0002',
  s.id,
  'Hub Console',
  'hubc_console',
  'internal-only-no-token',
  'trusted',
  '[]'::jsonb,
  'active'
FROM public.sites s
WHERE s.slug = 'hub-console'
ON CONFLICT (id) DO NOTHING;
