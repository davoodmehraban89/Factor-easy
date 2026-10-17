-- 1000 deterministic synthetic double-entry events + 1000 inverse reversal events.
-- Full Supabase CLI only, NEVER Production. All test rows ROLLBACK after assertions.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','phase1a-property@example.invalid',now(),'{}'::jsonb);
-- Draft vouchers; finalization from trusted local superuser exercises deferred guard.
WITH actor AS (
  SELECT organization_id FROM public.organization_members
  WHERE user_id='33333333-3333-4333-8333-333333333333' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT actor.organization_id,'33333333-3333-4333-8333-333333333333'::uuid,
 'journalVouchers','PROP'||lpad(g::text,6,'0'),
 jsonb_build_object('companyId','PROP_COMP','fiscalYearId','PROP_FY',
    'status','draft','number',g::text,'date','1405/07/24')
FROM actor CROSS JOIN generate_series(1,1000) g;
WITH actor AS (
  SELECT organization_id FROM public.organization_members
  WHERE user_id='33333333-3333-4333-8333-333333333333' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT actor.organization_id,'33333333-3333-4333-8333-333333333333'::uuid,
 'journalLines','PROPL'||lpad(g::text,6,'0')||s.side::text,
 jsonb_build_object('voucherId','PROP'||lpad(g::text,6,'0'),
 'companyId','PROP_COMP','accountId',case when s.side=1 then 'A' else 'B' end,
 'debit',case when s.side=1 then 1+abs(hashtext(g::text)::bigint)%9999999 else 0 end,
 'credit',case when s.side=2 then 1+abs(hashtext(g::text)::bigint)%9999999 else 0 end)
FROM actor CROSS JOIN generate_series(1,1000) g CROSS JOIN (values(1),(2)) s(side);
UPDATE public.records
SET data=jsonb_set(data,'{status}','"posted"')
WHERE collection='journalVouchers' AND id LIKE 'PROP%' AND owner_id='33333333-3333-4333-8333-333333333333';
-- Compensating posted reversal transactions. Old originals remain immutable.
WITH actor AS (
 SELECT organization_id FROM public.organization_members
 WHERE user_id='33333333-3333-4333-8333-333333333333' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT actor.organization_id,'33333333-3333-4333-8333-333333333333'::uuid,
 'journalVouchers','REVP'||lpad(g::text,6,'0'),
 jsonb_build_object('companyId','PROP_COMP','fiscalYearId','PROP_FY',
 'status','draft','voucherType','reversal','sourceType','reversal',
 'sourceId','PROP'||lpad(g::text,6,'0'),'number','R'||g::text,'date','1405/07/24')
FROM actor CROSS JOIN generate_series(1,1000) g;
WITH actor AS (
 SELECT organization_id FROM public.organization_members
 WHERE user_id='33333333-3333-4333-8333-333333333333' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT actor.organization_id,'33333333-3333-4333-8333-333333333333'::uuid,
 'journalLines','REVL'||lpad(g::text,6,'0')||s.side::text,
 jsonb_build_object('voucherId','REVP'||lpad(g::text,6,'0'),
 'companyId','PROP_COMP','accountId',case when s.side=1 then 'B' else 'A' end,
 'debit',case when s.side=1 then 1+abs(hashtext(g::text)::bigint)%9999999 else 0 end,
 'credit',case when s.side=2 then 1+abs(hashtext(g::text)::bigint)%9999999 else 0 end)
FROM actor CROSS JOIN generate_series(1,1000) g CROSS JOIN (values(1),(2)) s(side);
UPDATE public.records
SET data=jsonb_set(data,'{status}','"posted"')
WHERE collection='journalVouchers' AND id LIKE 'REVP%' AND owner_id='33333333-3333-4333-8333-333333333333';
-- Force all DEFERRED constraints to run before assertions/rollback.
SET CONSTRAINTS ALL IMMEDIATE;
DO $assert$
DECLARE vouchers integer; lines integer; unmatched integer; nonzero_accounts integer;
BEGIN
 SELECT count(*) INTO vouchers FROM public.records
 WHERE collection='journalVouchers' AND owner_id='33333333-3333-4333-8333-333333333333' AND data->>'status'='posted';
 SELECT count(*) INTO lines FROM public.records
 WHERE collection='journalLines' AND owner_id='33333333-3333-4333-8333-333333333333';
 WITH sums AS (
 SELECT data->>'accountId' account, sum((data->>'debit')::numeric-(data->>'credit')::numeric) net
 FROM public.records WHERE collection='journalLines'
 AND owner_id='33333333-3333-4333-8333-333333333333' GROUP BY 1
 ) SELECT count(*) INTO nonzero_accounts FROM sums WHERE net<>0;
 WITH line_totals AS (
  SELECT data->>'voucherId' vid,count(*) line_count,
  sum((data->>'debit')::numeric) debit,sum((data->>'credit')::numeric) credit
  FROM public.records WHERE collection='journalLines'
  AND owner_id='33333333-3333-4333-8333-333333333333' GROUP BY 1
 ) SELECT count(*) INTO unmatched FROM line_totals WHERE debit<>credit OR line_count<>2;
 IF vouchers<>2000 OR lines<>4000 OR unmatched<>0 OR nonzero_accounts<>0 THEN
   RAISE EXCEPTION 'Property failure: vouchers %, lines %, invalid %, account net nonzero %',
    vouchers,lines,unmatched,nonzero_accounts;
 END IF;
 RAISE NOTICE 'FINORA_1A_PROPERTY_PASS 1000 randomized postings, 1000 compensating reversals, 2000 posted vouchers, 4000 lines, account net zero';
END
$assert$;
ROLLBACK;
