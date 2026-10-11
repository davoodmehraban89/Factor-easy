-- Finora: prevent duplicate accounting finalization of the same source/version
-- Data preserving; no existing rows modified. Rollback:
-- DROP INDEX IF EXISTS public.ux_finora_posted_source_identity;
-- Preflight verified 2026-10-11: seven posted/reversed source vouchers, seven distinct source keys.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.collection='journalVouchers'
      AND r.data->>'status' IN ('posted','reversed')
      AND r.data->>'sourceType' IN ('sale','purchase','receipt','payment','expense','income')
      AND coalesce(r.data->>'sourceId','')<>''
    GROUP BY coalesce(r.organization_id::text,r.owner_id::text),
             r.data->>'sourceType',r.data->>'sourceId',
             coalesce(nullif(r.data->>'sourceVersion',''),'1')
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Duplicate posted sources exist; resolve before enabling idempotency index';
  END IF;
END
$guard$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finora_posted_source_identity
ON public.records (
  (coalesce(organization_id::text,owner_id::text)),
  ((data->>'sourceType')),
  ((data->>'sourceId')),
  (coalesce(nullif(data->>'sourceVersion',''),'1'))
)
WHERE collection='journalVouchers'
  AND data->>'status' IN ('posted','reversed')
  AND data->>'sourceType' IN ('sale','purchase','receipt','payment','expense','income')
  AND coalesce(data->>'sourceId','')<>'';
