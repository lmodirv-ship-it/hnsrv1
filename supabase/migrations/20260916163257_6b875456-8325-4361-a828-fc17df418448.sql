CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.cron_secrets FROM anon, authenticated;
GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cron_secrets (name, token)
VALUES ('group_daily_sync', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE tok text;
BEGIN
  SELECT token INTO tok FROM public.cron_secrets WHERE name = 'group_daily_sync';
  PERFORM cron.unschedule('hn-group-daily-sync')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hn-group-daily-sync');
  PERFORM cron.schedule(
    'hn-group-daily-sync',
    '0 3 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://hnsrv1.lovable.app/api/public/v1/sync/daily',
        headers := jsonb_build_object('Content-Type','application/json','x-hn-cron-key',%L),
        body := '{}'::jsonb
      );
    $cmd$, tok)
  );
END $$;