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

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaa1111-1111-4111-8111-111111111111',true);
SELECT public.finora_phase1a_publish_role_assignments(
 current_setting('finora_test.org_a')::uuid,'COMP_STAGE_1',
 '{"cash_default":"ACC_STAGE_1","revenue_default":"ACC_STAGE_2"}'::jsonb,
 0,'Owner approves realistic sale test chart');
DO $test$
DECLARE org_a uuid:=current_setting('finora_test.org_a')::uuid;
 org_b uuid:=current_setting('finora_test.org_b')::uuid;
 header jsonb:='{"companyId":"COMP_STAGE_1","fiscalYearId":"FY_STAGE_1","date":"1405/07/24","description":"Synthetic sale"}'::jsonb;
 lines jsonb:='[{"accountId":"ACC_STAGE_1","debit":100,"credit":0},{"accountId":"ACC_STAGE_2","debit":0,"credit":100}]'::jsonb;
 d jsonb;p jsonb;rv jsonb;ver bigint;denied int:=0;original_copy jsonb;
BEGIN
 -- Guard mode is checked by administrator in fixture; authenticated users cannot call its private helper.
 d:=public.finora_journal_create_draft(org_a,'VOUCHER_A_1',header,lines);
 IF (d#>>'{voucher,version}')::bigint<>1 THEN RAISE EXCEPTION 'FINORA_STAGE1_DRAFT_VERSION_FAILED';END IF;
 -- Duplicate click returns same header and no duplicate lines.
 d:=public.finora_journal_create_draft(org_a,'VOUCHER_A_1',header,lines);
 IF d->>'replayed'<>'true' OR (SELECT count(*) FROM public.records
 WHERE organization_id=org_a AND collection='journalLines' AND data->>'voucherId'='VOUCHER_A_1')<>2 THEN
  RAISE EXCEPTION 'FINORA_STAGE1_DOUBLE_CLICK_FAILED';END IF;
 BEGIN
  PERFORM public.finora_journal_create_draft(org_a,'VOUCHER_A_1',
  jsonb_set(header,'{description}','"different payload"'),lines);
  RAISE EXCEPTION 'FINORA_STAGE1_DIFF_RETRY_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN denied:=denied+1;END;
 -- Manual owner UPDATE then DELETE with CAS, no residual child records.
 d:=public.finora_journal_create_draft(org_a,'VOUCHER_A_EDIT',header,lines);
 d:=public.finora_journal_update_draft(org_a,'VOUCHER_A_EDIT',1,
 '{"description":"Owner corrected draft"}'::jsonb,lines);
 IF (d#>>'{voucher,version}')::bigint<>2 THEN
 RAISE EXCEPTION 'FINORA_STAGE1_OWNER_UPDATE_CAS_WRONG';END IF;
 PERFORM public.finora_journal_delete_draft(org_a,'VOUCHER_A_EDIT',2);
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org_a
 AND collection IN ('journalVouchers','journalLines')
 AND (id='VOUCHER_A_EDIT' OR data->>'voucherId'='VOUCHER_A_EDIT')) THEN
 RAISE EXCEPTION 'FINORA_STAGE1_OWNER_DELETE_LEFT_ROWS';END IF;
 p:=public.finora_journal_post(org_a,'VOUCHER_A_1',1);
 IF p#>>'{voucher,number}'<>'1' OR (p#>>'{voucher,version}')::bigint<>2 THEN
  RAISE EXCEPTION 'FINORA_STAGE1_POST_NUMBER_WRONG: %',p;END IF;
 SELECT data INTO original_copy FROM public.records WHERE organization_id=org_a
 AND collection='journalVouchers' AND id='VOUCHER_A_1';
 rv:=public.finora_journal_reverse(org_a,'VOUCHER_A_1','REVERSE_A_1','1405/07/24','Correction test',2,NULL);
 IF rv#>>'{voucher,number}'<>'2' OR (SELECT data FROM public.records
 WHERE organization_id=org_a AND collection='journalVouchers' AND id='VOUCHER_A_1') IS DISTINCT FROM original_copy THEN
  RAISE EXCEPTION 'FINORA_STAGE1_REVERSE_MUTATED_ORIGINAL: %',rv;END IF;
 IF (SELECT effective_status FROM public.finora_journal_reversal_status
 WHERE organization_id=org_a AND voucher_id='VOUCHER_A_1')<>'reversed' THEN
  RAISE EXCEPTION 'FINORA_STAGE1_REVERSE_VIEW_WRONG';END IF;
 FOR d IN SELECT jsonb_build_object('role','a','op',op) FROM (VALUES
 ('draft'),('post'),('reverse'),('delete')) t(op) LOOP
  BEGIN
   CASE d->>'op'
    WHEN 'draft' THEN PERFORM public.finora_journal_create_draft(org_b,'CROSS_VOUCHER',header,lines);
    WHEN 'post' THEN PERFORM public.finora_journal_post(org_b,'CROSS_VOUCHER',1);
    WHEN 'reverse' THEN PERFORM public.finora_journal_reverse(org_b,'VOUCHER_A_1','CROSS_REV_1','1405/07/24','Cross tenant',1,NULL);
    WHEN 'delete' THEN PERFORM public.finora_journal_delete_draft(org_b,'CROSS_VOUCHER',1);
   END CASE;
   RAISE EXCEPTION 'FINORA_STAGE1_CROSS_TENANT_ACCEPTED op=%',d->>'op';
  EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;END;
 END LOOP;
 IF denied<>5 THEN RAISE EXCEPTION 'FINORA_STAGE1_DENIAL_COUNT_WRONG %',denied;END IF;
 -- Cross-org explicit legacy/CAS calls and raw RLS must all refuse A->B.
 BEGIN
  PERFORM public.finora_sync_records('[]'::jsonb,'[]'::jsonb,org_b);
  RAISE EXCEPTION 'FINORA_STAGE1_A_TO_B_3ARG_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.finora_sync_records_v2('[]'::jsonb,'[]'::jsonb,org_b);
  RAISE EXCEPTION 'FINORA_STAGE1_A_TO_B_CAS_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.records(organization_id,owner_id,collection,id,data)
  VALUES(org_b,auth.uid(),'settings','RAW_A_TO_B','{}'::jsonb);
  RAISE EXCEPTION 'FINORA_STAGE1_A_TO_B_RAW_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.finora_sync_records(
 '[{"collection":"settings","id":"legacy_collision","data":{"marker":"A"}}]'::jsonb,
 '[]'::jsonb);
 RAISE NOTICE 'FINORA_STAGE1_SMOKE_A_PASS create, doubleclick, retry-conflict, post, reverse, view, tenant A->B';
END $test$;
SELECT set_config('request.jwt.claim.sub','bbbb2222-2222-4222-8222-222222222222',true);
DO $test$
DECLARE org_a uuid:=current_setting('finora_test.org_a')::uuid;
 org_b uuid:=current_setting('finora_test.org_b')::uuid;
 header jsonb:='{"companyId":"COMP_STAGE_1","fiscalYearId":"FY_STAGE_1","date":"1405/07/24"}'::jsonb;
 lines jsonb:='[{"accountId":"ACC_STAGE_1","debit":110,"credit":0},{"accountId":"ACC_STAGE_2","debit":0,"credit":110}]'::jsonb;
 d jsonb;
BEGIN
 d:=public.finora_journal_create_draft(org_b,'VOUCHER_B_1',header,lines);
 IF d#>>'{voucher,id}'<>'VOUCHER_B_1' THEN RAISE EXCEPTION 'FINORA_STAGE1_B_CREATE_FAIL';END IF;
 BEGIN
  PERFORM public.finora_journal_create_draft(org_a,'CROSS_VOUCHER_B',header,lines);
  RAISE EXCEPTION 'FINORA_STAGE1_CROSS_B_TO_A_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.finora_sync_records('[]'::jsonb,'[]'::jsonb,org_a);
  RAISE EXCEPTION 'FINORA_STAGE1_3ARG_B_TO_A_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.finora_sync_records_v2('[]'::jsonb,'[]'::jsonb,org_a);
  RAISE EXCEPTION 'FINORA_STAGE1_CAS_B_TO_A_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  INSERT INTO public.records(organization_id,owner_id,collection,id,data)
  VALUES(org_a,auth.uid(),'settings','RAW_B_TO_A','{}'::jsonb);
  RAISE EXCEPTION 'FINORA_STAGE1_B_TO_A_RAW_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.finora_sync_records(
 '[{"collection":"settings","id":"legacy_collision","data":{"marker":"B"}}]'::jsonb,
 '[]'::jsonb);
 RAISE NOTICE 'FINORA_STAGE1_SMOKE_B_PASS tenant B->A and legacy/CAS';
END $test$;
SELECT set_config('request.jwt.claim.sub','cccc3333-3333-4333-8333-333333333333',true);
DO $test$
DECLARE org_a uuid:=current_setting('finora_test.org_a')::uuid;
 header jsonb:='{"companyId":"COMP_STAGE_1","fiscalYearId":"FY_STAGE_1","date":"1405/07/24","sourceType":"sale","sourceId":"SOURCE_C_1"}'::jsonb;
 lines jsonb:='[{"accountId":"ACC_STAGE_1","debit":100,"credit":0},{"accountId":"ACC_STAGE_2","debit":0,"credit":100}]'::jsonb;
 r jsonb;
BEGIN
 BEGIN
  PERFORM public.finora_journal_create_draft(org_a,'C_MANUAL_DENY',
   header-'sourceType'-'sourceId',lines);
  RAISE EXCEPTION 'FINORA_STAGE1_C_ACCOUNTING_CREATE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 -- Negative tests must fail BEFORE creating an orphan draft or audit entry.
 BEGIN
  PERFORM public.finora_journal_autopost(org_a,'SOURCE_C_AMOUNT_DENY',
   'invoices','SOURCE_C_1',header,
   '[{"accountId":"ACC_STAGE_1","debit":101,"credit":0},{"accountId":"ACC_STAGE_2","debit":0,"credit":101}]'::jsonb);
  RAISE EXCEPTION 'FINORA_STAGE1_FALSE_SOURCE_AMOUNT_ACCEPTED';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE '%FINORA_POSTING_LINES_MISMATCH%' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.finora_journal_autopost(org_a,'SOURCE_C_KIND_DENY',
   'invoices','SOURCE_C_PROFORMA',
   jsonb_set(header,'{sourceId}','"SOURCE_C_PROFORMA"'),lines);
  RAISE EXCEPTION 'FINORA_STAGE1_PROFORMA_AS_SALE_ACCEPTED';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE '%FINORA_SOURCE_TYPE_OR_VERSION_MISMATCH%' THEN RAISE;END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.records
   WHERE organization_id=org_a AND collection='journalVouchers'
   AND id IN ('SOURCE_C_AMOUNT_DENY','SOURCE_C_KIND_DENY')) THEN
  RAISE EXCEPTION 'FINORA_STAGE1_ORPHAN_AFTER_SOURCE_REJECT';END IF;
 r:=public.finora_journal_autopost(org_a,'SOURCE_DOC_C_1','invoices','SOURCE_C_1',header,lines);
 IF r#>>'{voucher,status}'<>'posted' THEN RAISE EXCEPTION 'FINORA_STAGE1_SOURCE_POST_FAILED %',r;END IF;
 BEGIN
  PERFORM public.finora_journal_post(org_a,'VOUCHER_A_1',2);
  RAISE EXCEPTION 'FINORA_STAGE1_C_ACCOUNTING_APPROVE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 FOR r IN SELECT jsonb_build_object('op',op) FROM (VALUES
 ('update'),('delete'),('reverse')) AS z(op) LOOP
 BEGIN
 CASE r->>'op'
 WHEN 'update' THEN PERFORM public.finora_journal_update_draft(org_a,
 'VOUCHER_A_1',2,'{}'::jsonb,lines);
 WHEN 'delete' THEN PERFORM public.finora_journal_delete_draft(org_a,'VOUCHER_A_1',2);
 WHEN 'reverse' THEN PERFORM public.finora_journal_reverse(org_a,
 'VOUCHER_A_1','DENIED_C_REV','1405/07/24','Forbidden manual reverse',2,NULL);
 END CASE;
 RAISE EXCEPTION 'FINORA_STAGE1_COMMERCE_ROLE_ESCALATED op=%',r->>'op';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END LOOP;
 RAISE NOTICE 'FINORA_STAGE1_ROLE_PASS commerce source allowed, manual create/edit/delete/post/reverse denied';
END $test$;
RESET ROLE;
DO $tenant_keys$
DECLARE marker_a text;marker_b text;
BEGIN
 SELECT data->>'marker' INTO marker_a FROM public.records
 WHERE organization_id=current_setting('finora_test.org_a')::uuid
 AND collection='settings' AND id='legacy_collision';
 SELECT data->>'marker' INTO marker_b FROM public.records
 WHERE organization_id=current_setting('finora_test.org_b')::uuid
 AND collection='settings' AND id='legacy_collision';
 IF marker_a<>'A' OR marker_b<>'B' THEN
  RAISE EXCEPTION 'FINORA_STAGE1_LEGACY_TWO_ARG_TENANT_COLLISION a=% b=%',marker_a,marker_b;END IF;
 IF EXISTS(SELECT 1 FROM public.records WHERE collection='settings' AND id IN('RAW_A_TO_B','RAW_B_TO_A')) THEN
  RAISE EXCEPTION 'FINORA_STAGE1_DIRECT_CROSS_TENANT_INSERT_ACCEPTED';END IF;
 RAISE NOTICE 'FINORA_STAGE1_BOTH_DIRECTIONS_PASS direct,2arg,3arg,v2,journal';
END $tenant_keys$;
ROLLBACK;
