
INSERT INTO public.external_schema_mirrors (target_name, target_url, source_name, tables_count, status)
VALUES
  ('hn-db',    'https://hn-db.placeholder.local',    'hn-service-hub', 6, 'pending'),
  ('hn-cloud', 'https://hn-cloud.placeholder.local', 'hn-service-hub', 6, 'pending')
ON CONFLICT DO NOTHING;
