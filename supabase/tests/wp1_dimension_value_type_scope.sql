-- Dimension type/value consistency, company scope and active-state negative tests.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES('fb000000-0000-4000-8000-000000000001','wp1-dimension-scope@example.invalid',now(),'{}');
SELECT set_config('wp1.dimension_org',(SELECT id::text FROM public.organizations
 WHERE owner_user_id='fb000000-0000-4000-8000-000000000001'),true);
SELECT set_config('request.jwt.claim.sub','fb000000-0000-4000-8000-000000000001',true);
INSERT INTO public.records(owner_id,organization_id,collection,id,data) VALUES
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'companies','DS_C','{"name":"Dimension scope"}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'fiscalYears','DS_Y','{"companyId":"DS_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'accounts','DS_A','{"companyId":"DS_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'accounts','DS_B','{"companyId":"DS_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'dimensionTypes','DS_TYPE_A','{"companyId":"DS_C","active":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'dimensionTypes','DS_TYPE_B','{"companyId":"DS_C","active":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'dimensionValues','DS_VALUE_A','{"companyId":"DS_C","dimensionTypeId":"DS_TYPE_A","active":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'dimensionValues','DS_VALUE_B','{"companyId":"DS_C","dimensionTypeId":"DS_TYPE_B","active":true}'),
(auth.uid(),current_setting('wp1.dimension_org')::uuid,'dimensionValues','DS_VALUE_INACTIVE','{"companyId":"DS_C","dimensionTypeId":"DS_TYPE_A","active":false}');
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
VALUES(current_setting('wp1.dimension_org')::uuid,'enforce');
SET LOCAL ROLE authenticated;
DO $test$
DECLARE org uuid:=current_setting('wp1.dimension_org')::uuid; r jsonb; kind text;
BEGIN
 FOREACH kind IN ARRAY ARRAY['mismatched_type','inactive_value'] LOOP
  BEGIN
   r:=public.finora_journal_create_draft(org,'DS_BAD_'||kind,
    '{"companyId":"DS_C","fiscalYearId":"DS_Y","date":"1405/07/24"}',
    jsonb_build_array(
     jsonb_build_object('id','DS_BAD_'||kind||'_A','accountId','DS_A','debit',100,'credit',0,
      'dimensions',jsonb_build_array(jsonb_build_object('dimensionTypeId','DS_TYPE_A',
       'dimensionValueId',CASE WHEN kind='mismatched_type' THEN 'DS_VALUE_B' ELSE 'DS_VALUE_INACTIVE' END))),
     jsonb_build_object('id','DS_BAD_'||kind||'_B','accountId','DS_B','debit',0,'credit',100)));
   RAISE EXCEPTION 'WP1_INVALID_DIMENSION_ACCEPTED: %',kind;
  EXCEPTION WHEN foreign_key_violation THEN
   IF SQLERRM<>'FINORA_DIMENSION_OUT_OF_SCOPE' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT FROM public.records WHERE organization_id=org
   AND collection='journalVouchers' AND id='DS_BAD_'||kind) THEN
   RAISE EXCEPTION 'WP1_INVALID_DIMENSION_LEFT_PARTIAL_DRAFT: %',kind;
  END IF;
 END LOOP;
 r:=public.finora_journal_create_draft(org,'DS_VALID',
  '{"companyId":"DS_C","fiscalYearId":"DS_Y","date":"1405/07/24"}',
  jsonb_build_array(
   jsonb_build_object('id','DS_VALID_A','accountId','DS_A','debit',100,'credit',0,
    'dimensions',jsonb_build_array(jsonb_build_object('dimensionTypeId','DS_TYPE_A','dimensionValueId','DS_VALUE_A'))),
   jsonb_build_object('id','DS_VALID_B','accountId','DS_B','debit',0,'credit',100)));
 r:=public.finora_journal_post(org,'DS_VALID',(r#>>'{voucher,version}')::bigint);
 IF r#>>'{voucher,status}'<>'posted' THEN RAISE EXCEPTION 'WP1_VALID_DIMENSION_POST_FAILED'; END IF;
 SET CONSTRAINTS ALL IMMEDIATE;
 RAISE NOTICE 'WP1_DIMENSION_TYPE_VALUE_SCOPE_PASS: mismatch and inactive rejected; valid pair posts';
END $test$;
ROLLBACK;
