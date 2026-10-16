-- Phase 1A seeded randomized property suite, disposable Supabase CLI only.
-- seed=20261016; 1000 events, 2 organizations, 2..8 journal lines,
-- integer rial amounts, complete/partial compensating reversal vouchers.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('dddd4444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-random-a@example.invalid',now(),'{}'::jsonb),
('eeee5555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-random-b@example.invalid',now(),'{}'::jsonb);
SELECT set_config('phase1a_random.org_a',(SELECT organization_id::text FROM public.organization_members WHERE user_id='dddd4444-4444-4444-8444-444444444444' LIMIT 1),true);
SELECT set_config('phase1a_random.org_b',(SELECT organization_id::text FROM public.organization_members WHERE user_id='eeee5555-5555-4555-8555-555555555555' LIMIT 1),true);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'companies','COMP_RAND', '{"name":"Randomized Test Company"}'::jsonb
FROM public.organization_members m WHERE m.user_id IN ('dddd4444-4444-4444-8444-444444444444','eeee5555-5555-4555-8555-555555555555');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'fiscalYears','FY_RAND',
'{"companyId":"COMP_RAND","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb
FROM public.organization_members m WHERE m.user_id IN ('dddd4444-4444-4444-8444-444444444444','eeee5555-5555-4555-8555-555555555555');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'accounts','ACC_RAND_'||n,
jsonb_build_object('companyId','COMP_RAND','postingAllowed',true,'active',true,'code','700'||n)
FROM public.organization_members m CROSS JOIN generate_series(1,2) n WHERE m.user_id IN ('dddd4444-4444-4444-8444-444444444444','eeee5555-5555-4555-8555-555555555555');
-- Enforcement in this disposable SQL transaction ONLY, never Production.
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
SELECT organization_id,'enforce' FROM public.organization_members
WHERE user_id IN ('dddd4444-4444-4444-8444-444444444444','eeee5555-5555-4555-8555-555555555555');
SET LOCAL ROLE authenticated;
DO $random$
DECLARE
 seed bigint:=20261016; state bigint:=20261016;
 i int; n int;j int;amt bigint;each_credit bigint; org uuid; uid uuid;
 vid text; rid text; lines jsonb;header jsonb; v jsonb; saved jsonb;
 allocations jsonb; posted int:=0;complete int:=0;partial int:=0;
BEGIN
 FOR i IN 1..1000 LOOP
  state:=mod(state*1103515245+12345,2147483647);
  n:=2+mod(state,7)::integer;
  state:=mod(state*1103515245+12345,2147483647);
  amt:=(1000+mod(state,100000))*(n-1)*2;
  each_credit:=amt/(n-1);
  IF mod(i,2)=0 THEN
   org:=current_setting('phase1a_random.org_a')::uuid;
   uid:='dddd4444-4444-4444-8444-444444444444';
  ELSE
   org:=current_setting('phase1a_random.org_b')::uuid;
   uid:='eeee5555-5555-4555-8555-555555555555';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  vid:='SEEDED_'||lpad(i::text,6,'0');
  header:=jsonb_build_object('companyId','COMP_RAND','fiscalYearId','FY_RAND',
   'date','1405/07/24','description','Seeded event '||i);
  lines:=jsonb_build_array(jsonb_build_object(
   'accountId','ACC_RAND_1','debit',amt,'credit',0));
  FOR j IN 2..n LOOP
    lines:=lines||jsonb_build_array(jsonb_build_object(
      'accountId','ACC_RAND_2','debit',0,'credit',each_credit));
  END LOOP;
  v:=public.finora_journal_create_draft(org,vid,header,lines);
  v:=public.finora_journal_post(org,vid,(v#>>'{voucher,version}')::bigint);
  IF v#>>'{voucher,status}'<>'posted' THEN RAISE EXCEPTION 'FINORA_RANDOM_POST_FAILED i=%',i;END IF;
  posted:=posted+1;
  IF mod(i,5)=0 THEN
   rid:='FULL_R_'||lpad(i::text,6,'0');
   PERFORM public.finora_journal_reverse(org,vid,rid,'1405/07/24','Seeded full compensation',
    (v#>>'{voucher,version}')::bigint,NULL);
   complete:=complete+1;
  ELSIF mod(i,7)=0 THEN
   SELECT jsonb_agg(jsonb_build_object('lineId',id,
    'amount',(greatest((data->>'debit')::numeric,(data->>'credit')::numeric)/2)::bigint))
   INTO allocations FROM public.records
   WHERE organization_id=org AND collection='journalLines' AND data->>'voucherId'=vid;
   rid:='PART_R_'||lpad(i::text,6,'0');
   PERFORM public.finora_journal_reverse(org,vid,rid,'1405/07/24','Seeded partial compensation',
     (v#>>'{voucher,version}')::bigint,allocations);
   partial:=partial+1;
   IF mod(i,21)=0 THEN
    rid:='REST_R_'||lpad(i::text,6,'0');
    PERFORM public.finora_journal_reverse(org,vid,rid,'1405/07/24','Seeded remaining compensation',
     (v#>>'{voucher,version}')::bigint,allocations);
    complete:=complete+1;
   END IF;
  END IF;
 END LOOP;
 IF posted<>1000 OR partial<1 OR complete<1 THEN RAISE EXCEPTION 'FINORA_SEEDED_COVERAGE_FAILED';END IF;
 IF EXISTS(
  SELECT 1 FROM public.records rv
  JOIN public.records l ON l.organization_id=rv.organization_id
   AND l.collection='journalLines' AND l.data->>'voucherId'=rv.id
  WHERE rv.collection='journalVouchers' AND rv.id LIKE 'SEEDED_%'
  GROUP BY rv.organization_id,rv.id
  HAVING sum((l.data->>'debit')::numeric)<>sum((l.data->>'credit')::numeric)
 ) THEN RAISE EXCEPTION 'FINORA_SEEDED_VOUCHER_UNBALANCED';END IF;
 IF EXISTS(
  SELECT 1 FROM public.records rv
  JOIN public.records l ON l.organization_id=rv.organization_id
   AND l.collection='journalLines' AND l.data->>'voucherId'=rv.id
  WHERE rv.collection='journalVouchers'
  AND (rv.id LIKE 'SEEDED_%' OR rv.id LIKE 'FULL_R_%' OR rv.id LIKE 'PART_R_%' OR rv.id LIKE 'REST_R_%')
  GROUP BY rv.organization_id
  HAVING sum((l.data->>'debit')::numeric-(l.data->>'credit')::numeric)<>0
 ) THEN RAISE EXCEPTION 'FINORA_SEEDED_ORG_UNBALANCED';END IF;
 IF EXISTS(SELECT 1 FROM public.records rv JOIN public.records l
  ON l.collection='journalLines' AND l.data->>'voucherId'=rv.id
  WHERE rv.collection='journalVouchers' AND rv.id LIKE 'SEEDED_%'
  AND l.organization_id<>rv.organization_id) THEN
  RAISE EXCEPTION 'FINORA_SEEDED_ORG_LEAK';END IF;
 IF (SELECT count(*) FROM public.records WHERE collection='journalVouchers'
  AND id LIKE 'SEEDED_%')<>1000 THEN RAISE EXCEPTION 'FINORA_SEEDED_DUPLICATE_OR_MISSING';END IF;
 RAISE NOTICE 'FINORA_SEEDED_PASS seed=% original=% full_reversals=% partial_reversals=% orgs=2 lines=2..8 org_balance=0 leaks=0',
 seed,posted,complete,partial;
END $random$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
