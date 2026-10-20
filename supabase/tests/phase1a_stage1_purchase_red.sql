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


INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES
(current_setting('finora_test.org_a')::uuid,'aaaa1111-1111-4111-8111-111111111111',
 'accounts','ACC_PUR','{"companyId":"COMP_STAGE_1","code":"5101","title":"خرید کالا","systemRole":"purchase_default","accountType":"expense","normalBalance":"debit","level":"detail","parentId":"51","active":true,"postingAllowed":true}'::jsonb),
(current_setting('finora_test.org_a')::uuid,'aaaa1111-1111-4111-8111-111111111111',
 'accounts','ACC_AP','{"companyId":"COMP_STAGE_1","code":"2101","title":"حساب‌های پرداختنی","systemRole":"payable_control","accountType":"liability","normalBalance":"credit","level":"detail","parentId":"21","active":true,"postingAllowed":true}'::jsonb);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_test.org_a')::uuid,'cccc3333-3333-4333-8333-333333333333',
'purchases','PUR_RED_1','{"companyId":"COMP_STAGE_1","kind":"formal","paymentMethod":"credit","vatMode":"none","vatType":"percent","vatRate":0,"items":[{"qty":1,"price":100,"lineTotal":100}],"subtotal":100,"discount":0,"discountType":"fixed","discountInput":0,"vat":0,"grandTotal":100,"accountingVersion":1,"currencyCode":"IRR"}'::jsonb);
DO $t$ BEGIN IF private.finora_phase1a_mode(current_setting('finora_test.org_a')::uuid)<>'enforce' THEN
 RAISE EXCEPTION 'FINORA_GUARD_NOT_ENFORCE';END IF;END $t$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaa1111-1111-4111-8111-111111111111',true);
SELECT public.finora_phase1a_publish_role_assignments(current_setting('finora_test.org_a')::uuid,'COMP_STAGE_1',
 '{"purchase_default":"ACC_PUR","payable_control":"ACC_AP"}'::jsonb,0,
 'Owner confirms purchase semantic chart');
SELECT set_config('request.jwt.claim.sub','cccc3333-3333-4333-8333-333333333333',true);
DO $t$
DECLARE result jsonb;
BEGIN
 result:=public.finora_journal_autopost(current_setting('finora_test.org_a')::uuid,
 'PUR_RED_VOUCHER','purchases','PUR_RED_1',
 '{"companyId":"COMP_STAGE_1","fiscalYearId":"FY_STAGE_1","date":"1405/07/24",
 "sourceType":"purchase","sourceId":"PUR_RED_1","sourceVersion":"1"}'::jsonb,NULL);
 IF result#>>'{voucher,status}'<>'posted' THEN RAISE EXCEPTION 'FINORA_PURCHASE_RED_NOT_POSTED';END IF;
END $t$;
ROLLBACK;
