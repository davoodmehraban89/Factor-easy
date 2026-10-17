-- Stage 1 SQL behavioral suite, disposable Supabase CLI ONLY.
-- Roll back ALL synthetic users and ledger rows after checks.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES
('aaaa1111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-owner-a@example.invalid',now(),'{}'::jsonb),
('bbbb2222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-owner-b@example.invalid',now(),'{}'::jsonb),
('cccc3333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-member-c@example.invalid',now(),'{}'::jsonb);
SELECT set_config('finora_test.org_a',(SELECT organization_id::text FROM public.organization_members WHERE user_id='aaaa1111-1111-4111-8111-111111111111' LIMIT 1),true);
SELECT set_config('finora_test.org_b',(SELECT organization_id::text FROM public.organization_members WHERE user_id='bbbb2222-2222-4222-8222-222222222222' LIMIT 1),true);
-- Admin creates synthetic base chart so client/server validations use real scopes.
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'companies','COMP_STAGE_1',jsonb_build_object('name','Stage1 Test Co')
FROM public.organization_members m WHERE m.user_id IN
('aaaa1111-1111-4111-8111-111111111111','bbbb2222-2222-4222-8222-222222222222');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'fiscalYears','FY_STAGE_1',
 jsonb_build_object('companyId','COMP_STAGE_1','startDate','1405/01/01','endDate','1405/12/29','status','open')
FROM public.organization_members m WHERE m.user_id IN
('aaaa1111-1111-4111-8111-111111111111','bbbb2222-2222-4222-8222-222222222222');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT m.organization_id,m.user_id,'accounts','ACC_STAGE_'||n,
 jsonb_build_object('companyId','COMP_STAGE_1','postingAllowed',true,'active',true,
  'code',CASE WHEN n=1 THEN '1101' ELSE '4101' END,
  'title',CASE WHEN n=1 THEN 'صندوق و بانک' ELSE 'درآمد فروش' END,
  'normalBalance',CASE WHEN n=1 THEN 'debit' ELSE 'credit' END,
  'accountType',CASE WHEN n=1 THEN 'asset' ELSE 'revenue' END,
  'systemRole',CASE WHEN n=1 THEN 'cash_default' ELSE 'revenue_default' END,
  'level','detail','parentId',CASE WHEN n=1 THEN '11' ELSE '41' END)
FROM public.organization_members m CROSS JOIN generate_series(1,2) n WHERE m.user_id IN
('aaaa1111-1111-4111-8111-111111111111','bbbb2222-2222-4222-8222-222222222222');
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
SELECT organization_id,'enforce' FROM public.organization_members
WHERE user_id IN ('aaaa1111-1111-4111-8111-111111111111','bbbb2222-2222-4222-8222-222222222222');
-- Fixture seat capacity is raised ONLY inside this rolling-back local test;
-- the production license and its max_users are never accessed or changed.
UPDATE public.licenses SET max_users=GREATEST(max_users,3)
 WHERE organization_id=current_setting('finora_test.org_a')::uuid;
-- C joins org A and has commerce:create ONLY; no accounting:approve.
INSERT INTO public.organization_members(organization_id,user_id,status,is_owner)
VALUES (current_setting('finora_test.org_a')::uuid,'cccc3333-3333-4333-8333-333333333333','active',false);
INSERT INTO public.organization_roles(organization_id,role_key,title,is_system,active)
VALUES(current_setting('finora_test.org_a')::uuid,'phase1a_commerce_only','Test commerce create',false,true);
INSERT INTO public.organization_role_permissions(organization_id,role_id,module_key,capabilities)
SELECT organization_id,id,'commerce',ARRAY['create','read']::text[]
FROM public.organization_roles WHERE role_key='phase1a_commerce_only'
AND organization_id=current_setting('finora_test.org_a')::uuid;
INSERT INTO public.organization_member_roles(organization_id,member_id,role_id)
SELECT m.organization_id,m.id,r.id FROM public.organization_members m
JOIN public.organization_roles r ON r.organization_id=m.organization_id
WHERE m.user_id='cccc3333-3333-4333-8333-333333333333'
AND m.organization_id=current_setting('finora_test.org_a')::uuid AND r.role_key='phase1a_commerce_only';
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_test.org_a')::uuid,'cccc3333-3333-4333-8333-333333333333',
'invoices','SOURCE_C_1','{"companyId":"COMP_STAGE_1","kind":"formal","paymentMethod":"cash","vatMode":"none","vatType":"percent","vatRate":0,"items":[{"qty":1,"price":100,"lineTotal":100}],"subtotal":100,"discount":0,"discountType":"fixed","discountInput":0,"vat":0,"grandTotal":100,"accountingVersion":1}'::jsonb);
-- A pro-forma document must never post as a sale.
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_test.org_a')::uuid,
 'cccc3333-3333-4333-8333-333333333333',
 'invoices','SOURCE_C_PROFORMA','{"companyId":"COMP_STAGE_1","kind":"proforma","paymentMethod":"cash","vatMode":"none","vatType":"percent","vatRate":0,"items":[{"qty":1,"price":100,"lineTotal":100}],"subtotal":100,"discount":0,"discountType":"fixed","discountInput":0,"vat":0,"grandTotal":100,"accountingVersion":1}'::jsonb);


INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_test.org_a')::uuid,'aaaa1111-1111-4111-8111-111111111111',
'postingProfiles','PP_TEST',
'{"companyId":"COMP_STAGE_1","kind":"sale","debitAccountId":"ACC_STAGE_1","creditAccountId":"ACC_STAGE_2","active":true}'::jsonb);
INSERT INTO public.member_module_permissions(organization_id,member_id,module_key,capabilities)
SELECT organization_id,id,'accounting',ARRAY['read','create','edit']::text[]
FROM public.organization_members
WHERE organization_id=current_setting('finora_test.org_a')::uuid
AND user_id='cccc3333-3333-4333-8333-333333333333';
DO $q$ BEGIN
 IF private.finora_phase1a_mode(current_setting('finora_test.org_a')::uuid)<>'enforce' THEN
  RAISE EXCEPTION 'FINORA_ROLE_GUARD_NOT_ENFORCE';END IF;END $q$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccc3333-3333-4333-8333-333333333333',true);
DO $q$
DECLARE org uuid:=current_setting('finora_test.org_a')::uuid;
BEGIN
 BEGIN
  PERFORM public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object(
   'collection','accounts','id','ACC_STAGE_1','expected_version',1,
   'data',(SELECT data||'{"normalBalance":"credit"}'::jsonb FROM public.records
    WHERE organization_id=org AND collection='accounts' AND id='ACC_STAGE_1'))),
   '[]'::jsonb,org);
  RAISE EXCEPTION 'FINORA_BAD_ACCOUNT_WRITE_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%FINORA_ACCOUNT_MAPPING_SYNC_FORBIDDEN%' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object(
   'collection','postingProfiles','id','PP_TEST','expected_version',1,
   'data',(SELECT data||'{"creditAccountId":"ACC_STAGE_1"}'::jsonb FROM public.records
    WHERE organization_id=org AND collection='postingProfiles' AND id='PP_TEST'))),
   '[]'::jsonb,org);
  RAISE EXCEPTION 'FINORA_BAD_PROFILE_WRITE_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%FINORA_ACCOUNT_MAPPING_SYNC_FORBIDDEN%' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.finora_phase1a_publish_role_assignments(org,'COMP_STAGE_1',
   '{"cash_default":"ACC_STAGE_1","revenue_default":"ACC_STAGE_2"}',0,'Member denied');
  RAISE EXCEPTION 'FINORA_NONOWNER_ROLE_PUBLISH_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%FINORA_ROLE_ASSIGNMENT_OWNER_REQUIRED%' THEN RAISE;END IF;
 END;
END $q$;
RESET ROLE;
UPDATE private.finora_phase1a_guard_modes SET mode='audit'
 WHERE organization_id=current_setting('finora_test.org_a')::uuid;
DO $q$ BEGIN
 IF private.finora_phase1a_mode(current_setting('finora_test.org_a')::uuid)<>'audit' THEN
  RAISE EXCEPTION 'FINORA_ROLE_GUARD_NOT_AUDIT';END IF;END $q$;
SET LOCAL ROLE authenticated;
DO $q$
DECLARE org uuid:=current_setting('finora_test.org_a')::uuid;
BEGIN
 PERFORM public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object(
  'collection','accounts','id','ACC_STAGE_1','expected_version',1,
  'data',(SELECT data||'{"normalBalance":"credit"}'::jsonb FROM public.records
   WHERE organization_id=org AND collection='accounts' AND id='ACC_STAGE_1'))),
  '[]'::jsonb,org);
 PERFORM public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object(
  'collection','postingProfiles','id','PP_TEST','expected_version',1,
  'data',(SELECT data||'{"debitAccountId":"ACC_STAGE_2"}'::jsonb FROM public.records
   WHERE organization_id=org AND collection='postingProfiles' AND id='PP_TEST'))),
  '[]'::jsonb,org);
END $q$;
RESET ROLE;
DO $q$ BEGIN
 IF (SELECT count(*) FROM private.finora_phase1a_journal_audit
  WHERE organization_id=current_setting('finora_test.org_a')::uuid
  AND action='guard_violation'
  AND reason LIKE 'FINORA_DIRECT_ACCOUNT_MAPPING_WRITE%')<2 THEN
  RAISE EXCEPTION 'FINORA_ROLE_AUDIT_MISSING';END IF;END $q$;
UPDATE public.records SET data=data||'{"normalBalance":"debit"}'::jsonb
WHERE organization_id=current_setting('finora_test.org_a')::uuid
AND collection='accounts' AND id='ACC_STAGE_1';
UPDATE private.finora_phase1a_guard_modes SET mode='enforce'
 WHERE organization_id=current_setting('finora_test.org_a')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaa1111-1111-4111-8111-111111111111',true);
DO $q$
DECLARE r jsonb;
BEGIN
 r:=public.finora_phase1a_publish_role_assignments(
  current_setting('finora_test.org_a')::uuid,'COMP_STAGE_1',
  '{"cash_default":"ACC_STAGE_1","revenue_default":"ACC_STAGE_2"}',0,
  'Owner-approved initial account mapping');
 IF (r->>'version')::bigint<>1 THEN RAISE EXCEPTION 'FINORA_OWNER_PUBLISH_VERSION';END IF;
 BEGIN
  PERFORM public.finora_phase1a_publish_role_assignments(
   current_setting('finora_test.org_a')::uuid,'COMP_STAGE_1',
   '{"cash_default":"ACC_STAGE_2"}',1,'Invalid account role');
  RAISE EXCEPTION 'FINORA_INVALID_ACCOUNT_PUBLISHED';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE '%FINORA_POSTING_ACCOUNT_ROLE_INVALID%' THEN RAISE;END IF;
 END;
END $q$;
RESET ROLE;
DO $q$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.finora_phase1a_account_role_audit
 WHERE organization_id=current_setting('finora_test.org_a')::uuid
 AND version=1 AND action='publish'
 AND actor_id='aaaa1111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'FINORA_PUBLISH_AUDIT_MISSING';END IF;
 RAISE NOTICE 'FINORA_ACCOUNT_ROLE_GUARDS_PASS';
END $q$;
ROLLBACK;
