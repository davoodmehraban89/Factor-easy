-- 10,000 synthetic journal vouchers / 20,000 synthetic lines index benchmark.
-- Disposable Supabase CLI only; all inserted data rolls back.
\set ON_ERROR_STOP on
\timing on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('66666666-6666-4666-8666-666666666666','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','phase1a-perf@example.invalid',now(),'{}'::jsonb);
WITH org AS (
 SELECT organization_id FROM public.organization_members
 WHERE user_id='66666666-6666-4666-8666-666666666666' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT org.organization_id,'66666666-6666-4666-8666-666666666666'::uuid,
 'journalVouchers','PERF'||lpad(g::text,6,'0'),
 jsonb_build_object('status','draft','companyId','PERF_COMP','fiscalYearId','PERF_FY',
 'number',g::text,'date','1405/07/24')
FROM org CROSS JOIN generate_series(1,10000) g;
WITH org AS (
 SELECT organization_id FROM public.organization_members
 WHERE user_id='66666666-6666-4666-8666-666666666666' LIMIT 1
)
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT org.organization_id,'66666666-6666-4666-8666-666666666666'::uuid,
 'journalLines','PERFL'||lpad(g::text,6,'0')||side::text,
 jsonb_build_object('voucherId','PERF'||lpad(g::text,6,'0'),
 'companyId','PERF_COMP','accountId',case when side=1 then 'A' else 'B' end,
 'debit',case when side=1 then 1000 else 0 end,
 'credit',case when side=2 then 1000 else 0 end)
FROM org CROSS JOIN generate_series(1,10000) g CROSS JOIN (values(1),(2)) sides(side);
ANALYZE public.records;
SELECT count(*) AS synthetic_vouchers FROM public.records
WHERE owner_id='66666666-6666-4666-8666-666666666666' AND collection='journalVouchers';
SELECT count(*) AS synthetic_lines FROM public.records
WHERE owner_id='66666666-6666-4666-8666-666666666666' AND collection='journalLines';
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, data FROM public.records
WHERE collection='journalLines'
AND organization_id=(SELECT organization_id FROM public.organization_members
 WHERE user_id='66666666-6666-4666-8666-666666666666' LIMIT 1)
AND data->>'voucherId'='PERF009876';
ROLLBACK;
