CREATE TEMP TABLE _dups ON COMMIT DROP AS
WITH keyed AS (
  SELECT id,
         regexp_replace(regexp_replace(lower(base_url), '^https?://(www\.)?', ''), '/+$', '') AS dkey,
         row_number() OVER (
           PARTITION BY regexp_replace(regexp_replace(lower(base_url), '^https?://(www\.)?', ''), '/+$', '')
           ORDER BY (tvcc_id IS NULL), created_at
         ) AS rn
  FROM public.sites
), canon AS (
  SELECT dkey, id AS keep_id FROM keyed WHERE rn = 1
)
SELECT k.id AS drop_id, c.keep_id
FROM keyed k JOIN canon c ON c.dkey = k.dkey
WHERE k.rn > 1;

DELETE FROM public.services s
USING _dups d
WHERE s.site_id = d.drop_id
  AND EXISTS (SELECT 1 FROM public.services t WHERE t.site_id = d.keep_id AND t.slug = s.slug);

UPDATE public.services s SET site_id = d.keep_id FROM _dups d WHERE s.site_id = d.drop_id;
UPDATE public.websites_services w SET site_id = d.keep_id FROM _dups d WHERE w.site_id = d.drop_id;
UPDATE public.service_registry r SET site_id = d.keep_id FROM _dups d WHERE r.site_id = d.drop_id;

DELETE FROM public.sites s USING _dups d WHERE s.id = d.drop_id;