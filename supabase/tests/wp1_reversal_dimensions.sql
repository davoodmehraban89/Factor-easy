-- Real source-defined RPCs, synthetic users only. No dimension amount semantics exist.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('b6000000-0000-4000-8000-000000000001','wp1-dim-a@example.invalid',now(),'{}'),
('b6000000-0000-4000-8000-000000000002','wp1-dim-b@example.invalid',now(),'{}');
SELECT set_config('wp1.org',(SELECT id::text FROM public.organizations WHERE owner_user_id='b6000000-0000-4000-8000-000000000001'),true);
SELECT set_config('wp1.other',(SELECT id::text FROM public.organizations WHERE owner_user_id='b6000000-0000-4000-8000-000000000002'),true);
SELECT set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000001',true);
UPDATE public.licenses SET max_companies=greatest(max_companies,3) WHERE organization_id=current_setting('wp1.org')::uuid;
INSERT INTO public.records(owner_id,organization_id,collection,id,data) VALUES
(auth.uid(),current_setting('wp1.org')::uuid,'companies','DIM_C','{"name":"Dimension synthetic"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'companies','DIM_OTHER_C','{"name":"Other company"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'fiscalYears','DIM_Y','{"companyId":"DIM_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','DIM_A','{"companyId":"DIM_C","code":"1101","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','DIM_B','{"companyId":"DIM_C","code":"1102","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','DIM_CREDIT','{"companyId":"DIM_C","code":"4101","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'dimensionTypes','DIM_REQUIRED','{"companyId":"DIM_C","code":"D1","active":true,"sourceEntity":"manual"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'dimensionTypes','DIM_OPTIONAL','{"companyId":"DIM_C","code":"D2","active":true,"sourceEntity":"manual"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'dimensionValues','DIM_VALUE_A','{"companyId":"DIM_C","dimensionTypeId":"DIM_REQUIRED","code":"V1","active":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'dimensionValues','DIM_VALUE_B','{"companyId":"DIM_C","dimensionTypeId":"DIM_OPTIONAL","code":"V2","active":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accountDimensionRules','DIM_RULE_A','{"companyId":"DIM_C","accountId":"DIM_A","dimensionTypeId":"DIM_REQUIRED","applicability":"required","active":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accountDimensionRules','DIM_RULE_B','{"companyId":"DIM_C","accountId":"DIM_B","dimensionTypeId":"DIM_OPTIONAL","applicability":"optional","active":true}');
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode) VALUES(current_setting('wp1.org')::uuid,'enforce');
-- Foreign tenant deliberately reuses the line/voucher IDs: a missing org predicate would leak its tag.
INSERT INTO public.records(owner_id,organization_id,collection,id,data) VALUES
('b6000000-0000-4000-8000-000000000002',current_setting('wp1.other')::uuid,'journalLineDimensions','FOREIGN_DIM',
'{"companyId":"DIM_C","voucherId":"DIM_FULL","journalLineId":"DIM_FULL_A","dimensionTypeId":"FOREIGN_TYPE","dimensionValueId":"FOREIGN_VALUE"}');

CREATE FUNCTION pg_temp.assert_reversal_dimensions(org uuid, original_id text, reversal_id text, expected_lines int, expected_dimensions int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE l record; want jsonb; got jsonb;
BEGIN
 IF (SELECT count(*) FROM public.records WHERE organization_id=org AND collection='journalLines' AND data->>'voucherId'=reversal_id)<>expected_lines
 OR (SELECT count(*) FROM public.records WHERE organization_id=org AND collection='journalLineDimensions' AND data->>'voucherId'=reversal_id)<>expected_dimensions THEN
  RAISE EXCEPTION 'WP1_REVERSAL_DIMENSIONS_LOST: %',reversal_id;
 END IF;
 FOR l IN SELECT id,data FROM public.records WHERE organization_id=org AND collection='journalLines' AND data->>'voucherId'=reversal_id LOOP
  SELECT coalesce(jsonb_agg(jsonb_build_array(data->>'dimensionTypeId',data->>'dimensionValueId') ORDER BY data->>'dimensionTypeId',data->>'dimensionValueId'),'[]') INTO want
  FROM public.records WHERE organization_id=org AND collection='journalLineDimensions' AND data->>'voucherId'=original_id AND data->>'journalLineId'=l.data->>'reversesLineId';
  SELECT coalesce(jsonb_agg(jsonb_build_array(data->>'dimensionTypeId',data->>'dimensionValueId') ORDER BY data->>'dimensionTypeId',data->>'dimensionValueId'),'[]') INTO got
  FROM public.records WHERE organization_id=org AND collection='journalLineDimensions' AND data->>'voucherId'=reversal_id AND data->>'journalLineId'=l.id;
  IF want IS DISTINCT FROM got THEN RAISE EXCEPTION 'WP1_REVERSAL_DIMENSIONS_WRONG_LINE: %',l.id; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM public.records WHERE organization_id=org AND collection='journalLineDimensions' AND data->>'voucherId'=reversal_id
 AND (data->>'companyId'<>'DIM_C' OR data ? 'amount' OR data ? 'debit' OR data ? 'credit')) THEN RAISE EXCEPTION 'WP1_DIMENSION_SCHEMA_CHANGED'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE org uuid:=current_setting('wp1.org')::uuid; v text; r jsonb; original_rows jsonb; after_rows jsonb; replay_rows jsonb; allocations jsonb; denied int:=0;
BEGIN
 FOREACH v IN ARRAY ARRAY['DIM_FULL','DIM_PARTIAL'] LOOP
  r:=public.finora_journal_create_draft(org,v,'{"companyId":"DIM_C","fiscalYearId":"DIM_Y","date":"1405/07/24"}',
   jsonb_build_array(
    jsonb_build_object('id',v||'_A','accountId','DIM_A','debit',60,'credit',0,'dimensions','[{"dimensionTypeId":"DIM_REQUIRED","dimensionValueId":"DIM_VALUE_A"},{"dimensionTypeId":"DIM_OPTIONAL","dimensionValueId":"DIM_VALUE_B"}]'::jsonb),
    jsonb_build_object('id',v||'_B','accountId','DIM_B','debit',40,'credit',0,'dimensions','[{"dimensionTypeId":"DIM_OPTIONAL","dimensionValueId":"DIM_VALUE_B"}]'::jsonb),
    jsonb_build_object('id',v||'_C','accountId','DIM_CREDIT','debit',0,'credit',100)));
  PERFORM public.finora_journal_post(org,v,(r#>>'{voucher,version}')::bigint);
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO original_rows FROM public.records x WHERE organization_id=org AND
 ((collection='journalVouchers' AND id IN ('DIM_FULL','DIM_PARTIAL')) OR (collection IN ('journalLines','journalLineDimensions') AND data->>'voucherId' IN ('DIM_FULL','DIM_PARTIAL')));
 r:=public.finora_journal_reverse(org,'DIM_FULL','DIM_FULL_REVERSED','1405/07/25','Full dimension reversal',2,NULL);
 PERFORM pg_temp.assert_reversal_dimensions(org,'DIM_FULL','DIM_FULL_REVERSED',3,3);
 -- Analytic balances net to zero for every account/type/value, using line amounts.
 IF EXISTS(SELECT l.data->>'accountId',d.data->>'dimensionTypeId',d.data->>'dimensionValueId'
 FROM public.records l JOIN public.records d ON d.organization_id=l.organization_id AND d.collection='journalLineDimensions' AND d.data->>'journalLineId'=l.id AND d.data->>'voucherId'=l.data->>'voucherId'
 WHERE l.organization_id=org AND l.collection='journalLines' AND l.data->>'voucherId' IN ('DIM_FULL','DIM_FULL_REVERSED')
 GROUP BY 1,2,3 HAVING sum((l.data->>'debit')::numeric-(l.data->>'credit')::numeric)<>0) THEN RAISE EXCEPTION 'WP1_ANALYTIC_BALANCE_NOT_REVERSED'; END IF;
 allocations:='[{"lineId":"DIM_PARTIAL_A","amount":25},{"lineId":"DIM_PARTIAL_C","amount":25}]';
 PERFORM public.finora_journal_reverse(org,'DIM_PARTIAL','DIM_PART_1','1405/07/25','Partial dimension reversal',2,allocations);
 PERFORM pg_temp.assert_reversal_dimensions(org,'DIM_PARTIAL','DIM_PART_1',2,2);
 IF (SELECT sum((data->>'credit')::numeric) FROM public.records WHERE organization_id=org AND collection='journalLines' AND data->>'voucherId'='DIM_PART_1')<>25 THEN RAISE EXCEPTION 'WP1_PARTIAL_AMOUNT_CHANGED'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO replay_rows FROM public.records x WHERE organization_id=org;
 r:=public.finora_journal_reverse(org,'DIM_PARTIAL','DIM_PART_1','1405/07/25','Partial dimension reversal',0,allocations);
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO after_rows FROM public.records x WHERE organization_id=org;
 IF r->>'replayed'<>'true' OR replay_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'WP1_DIMENSION_REPLAY_MUTATED'; END IF;
 BEGIN
  PERFORM public.finora_journal_reverse(org,'DIM_PARTIAL','DIM_PART_1','1405/07/25','Partial dimension reversal',2,jsonb_set(allocations,'{0,amount}','26'));
  RAISE EXCEPTION 'WP1_CHANGED_REPLAY_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN denied:=denied+1; END;
 PERFORM public.finora_journal_reverse(org,'DIM_PARTIAL','DIM_PART_2','1405/07/25','Remaining dimension reversal',2,
 '[{"lineId":"DIM_PARTIAL_A","amount":35},{"lineId":"DIM_PARTIAL_B","amount":40},{"lineId":"DIM_PARTIAL_C","amount":75}]');
 PERFORM pg_temp.assert_reversal_dimensions(org,'DIM_PARTIAL','DIM_PART_2',3,3);
 BEGIN
  PERFORM public.finora_journal_reverse(org,'DIM_PARTIAL','DIM_TOO_MUCH','1405/07/25','Excess reversal rejected',2,allocations);
  RAISE EXCEPTION 'WP1_OVER_REVERSAL_ACCEPTED';
 EXCEPTION WHEN check_violation THEN IF sqlerrm NOT LIKE 'FINORA_REVERSAL_OVER_ALLOCATION%' THEN RAISE; END IF; denied:=denied+1; END;
 BEGIN
  PERFORM public.finora_journal_reverse(current_setting('wp1.other')::uuid,'DIM_FULL','DIM_WRONG_TENANT','1405/07/25','Tenant isolation reversal',2,NULL);
  RAISE EXCEPTION 'WP1_FOREIGN_REVERSAL_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO after_rows FROM public.records x WHERE organization_id=org AND
 ((collection='journalVouchers' AND id IN ('DIM_FULL','DIM_PARTIAL')) OR (collection IN ('journalLines','journalLineDimensions') AND data->>'voucherId' IN ('DIM_FULL','DIM_PARTIAL')));
 IF original_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'WP1_ORIGINAL_DIMENSION_HISTORY_CHANGED'; END IF;
 IF denied<>3 THEN RAISE EXCEPTION 'WP1_DIMENSION_NEGATIVES_MISSING'; END IF;
 RAISE NOTICE 'WP1_REVERSAL_DIMENSIONS_PASS: full, partial, remainder, replay, changed retry, over-allocation, tenant scope, immutable originals';
END $$;
-- Corrupted legacy metadata is seeded only as the local superuser. The RPC
-- must reject it without silently dropping a link or rewriting financial history.
DO $$
DECLARE org uuid:=current_setting('wp1.org')::uuid; v text; r jsonb;
BEGIN
 FOREACH v IN ARRAY ARRAY['DIM_BAD_COMPANY','DIM_BAD_VOUCHER'] LOOP
  r:=public.finora_journal_create_draft(org,v,'{"companyId":"DIM_C","fiscalYearId":"DIM_Y","date":"1405/07/24"}',
   jsonb_build_array(jsonb_build_object('id',v||'_A','accountId','DIM_A','debit',10,'credit',0),
                    jsonb_build_object('id',v||'_B','accountId','DIM_CREDIT','debit',0,'credit',10)));
  PERFORM public.finora_journal_post(org,v,(r#>>'{voucher,version}')::bigint);
 END LOOP;
END $$;
RESET ROLE;
ALTER TABLE public.records DISABLE TRIGGER USER;
INSERT INTO public.records(owner_id,organization_id,collection,id,data) VALUES
(auth.uid(),current_setting('wp1.org')::uuid,'journalLineDimensions','LEGACY_WRONG_COMPANY',
'{"companyId":"DIM_OTHER_C","voucherId":"DIM_BAD_COMPANY","journalLineId":"DIM_BAD_COMPANY_A","dimensionTypeId":"DIM_REQUIRED","dimensionValueId":"DIM_VALUE_A"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'journalLineDimensions','LEGACY_WRONG_VOUCHER',
'{"companyId":"DIM_C","voucherId":"DIM_OTHER_VOUCHER","journalLineId":"DIM_BAD_VOUCHER_A","dimensionTypeId":"DIM_REQUIRED","dimensionValueId":"DIM_VALUE_A"}');
ALTER TABLE public.records ENABLE TRIGGER USER;
SET LOCAL ROLE authenticated;
DO $$
DECLARE org uuid:=current_setting('wp1.org')::uuid; v text; before_rows jsonb; after_rows jsonb; denied int:=0;
BEGIN
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO before_rows FROM public.records x WHERE organization_id=org;
 FOREACH v IN ARRAY ARRAY['DIM_BAD_COMPANY','DIM_BAD_VOUCHER'] LOOP
  BEGIN
   PERFORM public.finora_journal_reverse(org,v,v||'_REV','1405/07/25','Malformed legacy scope rejection',2,NULL);
   RAISE EXCEPTION 'WP1_LEGACY_DIMENSION_SCOPE_ACCEPTED: %',v;
  EXCEPTION WHEN foreign_key_violation THEN
   IF sqlerrm NOT LIKE 'FINORA_DIMENSION_OUT_OF_SCOPE%' THEN RAISE; END IF;
   denied:=denied+1;
  END;
 END LOOP;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY collection,id) INTO after_rows FROM public.records x WHERE organization_id=org;
 IF denied<>2 OR before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'WP1_LEGACY_DIMENSION_SCOPE_MUTATED'; END IF;
 RAISE NOTICE 'WP1_LEGACY_DIMENSION_SCOPE_PASS: wrong-company and wrong-voucher fail closed with unchanged rows';
END $$;
ROLLBACK;
