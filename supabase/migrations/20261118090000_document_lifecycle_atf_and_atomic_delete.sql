-- Document lifecycle contract: immutable ATF identity, temporary numbering, draft-first lifecycle,
-- atomic source/voucher deletion, and append-only deletion audit.
-- Candidate only. Do not apply to Production without explicit owner approval.
--
-- Rules:
--   1) Every accounting document receives a permanent, never-reused atfNumber.
--   2) Drafts receive a temporaryNumber. Final number is allocated only at posting.
--   3) Deleting a source-linked draft is only allowed from the source document.
--   4) Deleting a source draft atomically deletes its draft journal voucher/lines.
--   5) Journal/source deletion is audited before rows disappear.
--   6) Existing posted history is NOT silently converted by this migration. A separate
--      explicit legacy-conversion RPC is provided and must be run deliberately.

CREATE TABLE IF NOT EXISTS private.finora_document_atf_counters(
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 last_no bigint NOT NULL DEFAULT 0 CHECK(last_no>=0 AND last_no<9223372036854775807)
);
REVOKE ALL ON private.finora_document_atf_counters FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.finora_document_temp_counters(
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 fiscal_year_id text NOT NULL,
 last_no bigint NOT NULL DEFAULT 0 CHECK(last_no>=0 AND last_no<9223372036854775807),
 PRIMARY KEY(organization_id,fiscal_year_id)
);
REVOKE ALL ON private.finora_document_temp_counters FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.finora_next_document_atf(p_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE n bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=auth.uid() AND status='active') THEN
   RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 INSERT INTO private.finora_document_atf_counters(organization_id,last_no)
 VALUES(p_org,0) ON CONFLICT (organization_id) DO NOTHING;
 SELECT last_no INTO n FROM private.finora_document_atf_counters
 WHERE organization_id=p_org FOR UPDATE;
 n:=n+1;
 UPDATE private.finora_document_atf_counters SET last_no=n WHERE organization_id=p_org;
 RETURN n::text;
END $$;

CREATE OR REPLACE FUNCTION private.finora_next_document_temp(p_org uuid,p_fy text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE n bigint;
BEGIN
 IF p_fy IS NULL OR p_fy='' THEN RAISE EXCEPTION 'FINORA_FISCAL_OR_COMPANY_INVALID' USING ERRCODE='23514'; END IF;
 INSERT INTO private.finora_document_temp_counters(organization_id,fiscal_year_id,last_no)
 VALUES(p_org,p_fy,0) ON CONFLICT (organization_id,fiscal_year_id) DO NOTHING;
 SELECT last_no INTO n FROM private.finora_document_temp_counters
 WHERE organization_id=p_org AND fiscal_year_id=p_fy FOR UPDATE;
 n:=n+1;
 UPDATE private.finora_document_temp_counters SET last_no=n
 WHERE organization_id=p_org AND fiscal_year_id=p_fy;
 RETURN n::text;
END $$;

REVOKE ALL ON FUNCTION private.finora_next_document_atf(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_next_document_temp(uuid,text) FROM PUBLIC,anon,authenticated;

-- Permanent identity must never be reused, including after deletion.
CREATE UNIQUE INDEX IF NOT EXISTS ux_finora_document_atf_journal
 ON public.records(organization_id,(data->>'atfNumber'))
 WHERE collection='journalVouchers' AND coalesce(data->>'atfNumber','')<>'';

CREATE INDEX IF NOT EXISTS idx_finora_document_atf_source
 ON public.records(organization_id,(data->>'atfNumber'))
 WHERE collection IN ('invoices','purchases') AND coalesce(data->>'atfNumber','')<>'';


-- Draft commercial documents receive the same permanent ATF identity at first persistence.
-- This covers the current sales/purchase source adapters; additional document modules
-- will be added only after their own delete/link contracts are tested.
CREATE OR REPLACE FUNCTION private.finora_stamp_source_document_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $
DECLARE fy text; tmp text;
BEGIN
 IF new.collection NOT IN ('invoices','purchases') THEN RETURN new; END IF;
 IF coalesce(new.data->>'atfNumber','')='' THEN
   new.data:=new.data||jsonb_build_object('atfNumber',private.finora_next_document_atf(new.organization_id));
 END IF;
 IF coalesce(new.data->>'documentStatus','draft')='draft' AND coalesce(new.data->>'temporaryNumber','')='' THEN
   SELECT id INTO fy FROM public.records
   WHERE organization_id=new.organization_id AND collection='fiscalYears'
    AND data->>'companyId'=new.data->>'companyId'
    AND coalesce(data->>'status','open')<>'locked'
    AND coalesce(new.data->>'date','')>=data->>'startDate'
    AND coalesce(new.data->>'date','')<=data->>'endDate'
   ORDER BY id LIMIT 1;
   IF fy IS NOT NULL THEN
     tmp:=private.finora_next_document_temp(new.organization_id,fy);
     new.data:=new.data||jsonb_build_object('temporaryNumber',tmp);
   END IF;
 END IF;
 RETURN new;
END $;

DROP TRIGGER IF EXISTS trg_finora_stamp_source_document_identity ON public.records;
CREATE TRIGGER trg_finora_stamp_source_document_identity
BEFORE INSERT ON public.records FOR EACH ROW
EXECUTE FUNCTION private.finora_stamp_source_document_identity();
REVOKE ALL ON FUNCTION private.finora_stamp_source_document_identity() FROM PUBLIC,anon,authenticated;

-- Replace the draft core so every new journal document receives ATF + temporary number.
CREATE OR REPLACE FUNCTION private.finora_phase1a_create_core(
 p_org uuid,p_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_fy text:=p_header->>'fiscalYearId';
 v_company text:=p_header->>'companyId';
 v_date text:=p_header->>'date';
 v_src text:=coalesce(p_header->>'sourceType','manual');
 v_fp text:=md5(jsonb_build_object('header',p_header,'lines',p_lines)::text);
 v_existing public.records%rowtype; v_current public.records%rowtype;
 v_atf text; v_tmp text;
BEGIN
 IF v_actor IS NULL OR length(coalesce(p_id,''))<5 OR length(p_id)>160
  OR jsonb_typeof(p_header)<>'object'
  OR p_header ?| array['status','number','postedAt','postedBy','reversedAt','reversalVoucherId']
 THEN RAISE EXCEPTION 'FINORA_DRAFT_INVALID_HEADER' USING ERRCODE='23514';END IF;

 SELECT * INTO v_existing FROM public.records
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id FOR UPDATE;
 IF FOUND THEN
  IF v_existing.data->>'requestFingerprint'=v_fp THEN
   RETURN jsonb_build_object('voucher',v_existing.data||jsonb_build_object('id',v_existing.id,'version',v_existing.version),'replayed',true);
  END IF;
  RAISE EXCEPTION 'FINORA_DRAFT_REQUEST_CONFLICT' USING ERRCODE='40001';
 END IF;

 IF v_fy IS NULL OR v_company IS NULL OR v_date IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.records fy WHERE fy.organization_id=p_org
    AND fy.collection='fiscalYears' AND fy.id=v_fy AND fy.data->>'companyId'=v_company
    AND coalesce(fy.data->>'status','open')<>'locked'
    AND v_date>=fy.data->>'startDate' AND v_date<=fy.data->>'endDate')
  OR NOT EXISTS(SELECT 1 FROM public.records c WHERE c.organization_id=p_org
    AND c.collection='companies' AND c.id=v_company) THEN
  RAISE EXCEPTION 'FINORA_FISCAL_OR_COMPANY_INVALID' USING ERRCODE='23514';
 END IF;

 v_atf:=private.finora_next_document_atf(p_org);
 v_tmp:=private.finora_next_document_temp(p_org,v_fy);

 INSERT INTO public.records(organization_id,owner_id,collection,id,data)
 VALUES(p_org,v_actor,'journalVouchers',p_id,
   jsonb_build_object(
    'companyId',v_company,'fiscalYearId',v_fy,'date',v_date,
    'description',coalesce(p_header->>'description',''),
    'reference',coalesce(p_header->>'reference',''),
    'voucherType',coalesce(p_header->>'voucherType','manual'),
    'sourceType',v_src,'sourceId',coalesce(p_header->>'sourceId',''),
    'sourceVersion',coalesce(p_header->>'sourceVersion','1'),
    'atfNumber',v_atf,'temporaryNumber',v_tmp,
    'reversalReason',coalesce(p_header->>'reversalReason',''),
    'reversalAllocations',coalesce(p_header->'reversalAllocations','null'::jsonb),
    'status','draft','createdAt',clock_timestamp(),'createdBy',v_actor,
    'requestFingerprint',v_fp))
 ON CONFLICT (organization_id,collection,id) DO NOTHING;

 IF NOT FOUND THEN
  SELECT * INTO v_existing FROM public.records WHERE organization_id=p_org
   AND collection='journalVouchers' AND id=p_id FOR UPDATE;
  IF FOUND AND v_existing.data->>'requestFingerprint'=v_fp THEN
   RETURN jsonb_build_object('voucher',
    v_existing.data||jsonb_build_object('id',v_existing.id,'version',v_existing.version),
    'replayed',true);
  END IF;
  RAISE EXCEPTION 'FINORA_DRAFT_REQUEST_CONFLICT' USING ERRCODE='40001';
 END IF;

 PERFORM private.finora_phase1a_write_lines(p_org,v_actor,p_id,v_company,p_lines);
 PERFORM private.finora_phase1a_validate_saved(p_org,p_id,v_company);
 PERFORM private.finora_phase1a_audit_event(p_org,p_id,v_actor,'draft_created','',
   jsonb_build_object('sourceType',v_src,'atfNumber',v_atf,'temporaryNumber',v_tmp));

 SELECT * INTO v_current FROM public.records WHERE organization_id=p_org
 AND collection='journalVouchers' AND id=p_id;
 RETURN jsonb_build_object('voucher',
   v_current.data||jsonb_build_object('id',p_id,'version',v_current.version),
   'replayed',false);
END $fn$;

-- A source-linked draft must be deleted from its source, not from the ledger list.
CREATE OR REPLACE FUNCTION public.finora_journal_delete_draft(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',NULL);
 SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
 IF NOT FOUND OR v.data->>'status'<>'draft' OR coalesce(v.data->>'sourceType','manual')<>'manual'
 THEN
   IF FOUND AND v.data->>'status'='draft' AND coalesce(v.data->>'sourceId','')<>'' THEN
     RAISE EXCEPTION 'FINORA_DELETE_VIA_SOURCE: این سند از یک سند منبع ایجاد شده است؛ حذف را از خود سند منبع انجام دهید.' USING ERRCODE='42501';
   END IF;
   RAISE EXCEPTION 'FINORA_DRAFT_DELETE_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001'; END IF;

 PERFORM private.finora_phase1a_audit_event(
   p_organization_id,p_voucher_id,auth.uid(),'draft_deleted','',
   jsonb_build_object(
     'collection','journalVouchers','atfNumber',v.data->>'atfNumber',
     'temporaryNumber',v.data->>'temporaryNumber','number',v.data->>'number',
     'sourceType',v.data->>'sourceType','sourceId',v.data->>'sourceId',
     'reason','manual_draft_delete'));

 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLineDimensions' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLines' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id;

 RETURN jsonb_build_object('deleted',true,'voucherId',p_voucher_id,
   'atfNumber',v.data->>'atfNumber');
END $fn$;

-- Delete a draft source and its draft accounting document atomically.
-- v1 covers sales and purchases; other source modules are deliberately added
-- only after their own lifecycle contracts are proven.
CREATE OR REPLACE FUNCTION public.finora_document_delete_draft(
 p_organization_id uuid,p_collection text,p_document_id text,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 src public.records%rowtype;
 j public.records%rowtype;
 v_source_type text;
 v_journal_id text;
BEGIN
 v_source_type:=CASE p_collection WHEN 'invoices' THEN 'sale' WHEN 'purchases' THEN 'purchase' ELSE NULL END;
 IF v_source_type IS NULL THEN
   RAISE EXCEPTION 'FINORA_DOCUMENT_DELETE_UNSUPPORTED' USING ERRCODE='0A000';
 END IF;
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',v_source_type);

 SELECT * INTO src FROM public.records
 WHERE organization_id=p_organization_id AND collection=p_collection
 AND id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_FOUND' USING ERRCODE='23503'; END IF;
 IF src.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF coalesce(src.data->>'documentStatus','draft')<>'draft'
    OR coalesce(src.data->>'accountingStatus','draft')<>'draft'
    OR coalesce(src.data->>'journalVoucherId','')<>'' THEN
   IF coalesce(src.data->>'accountingPostingPending','false')='true' THEN
     RAISE EXCEPTION 'FINORA_DOCUMENT_DELETE_PENDING' USING ERRCODE='40001';
   END IF;
   RAISE EXCEPTION 'FINORA_DOCUMENT_DELETE_REQUIRES_DRAFT' USING ERRCODE='23514';
 END IF;

 SELECT * INTO j FROM public.records
 WHERE organization_id=p_organization_id AND collection='journalVouchers'
 AND data->>'sourceType'=v_source_type AND data->>'sourceId'=p_document_id
 AND data->>'status'='draft'
 ORDER BY version DESC LIMIT 1 FOR UPDATE;

 IF FOUND THEN
   v_journal_id:=j.id;
 ELSE
   SELECT * INTO j FROM public.records
   WHERE organization_id=p_organization_id AND collection='journalVouchers'
   AND data->>'sourceType'=v_source_type AND data->>'sourceId'=p_document_id
   AND data->>'status' IN ('posted','reversed')
   LIMIT 1 FOR UPDATE;
   IF FOUND THEN
     RAISE EXCEPTION 'FINORA_DOCUMENT_DELETE_POSTED_LINK' USING ERRCODE='23514';
   END IF;
 END IF;

 PERFORM private.finora_phase1a_audit_event(
   p_organization_id,p_document_id,v_actor,'document_deleted','',
   jsonb_build_object(
     'collection',p_collection,'documentId',p_document_id,
     'atfNumber',src.data->>'atfNumber',
     'temporaryNumber',src.data->>'temporaryNumber',
     'number',src.data->>'number',
     'sourceType',v_source_type,
     'journalVoucherId',coalesce(v_journal_id,''),
     'reason','source_draft_delete'));

 IF v_journal_id IS NOT NULL THEN
   PERFORM private.finora_phase1a_audit_event(
     p_organization_id,v_journal_id,v_actor,'draft_deleted','',
     jsonb_build_object(
       'collection','journalVouchers','atfNumber',j.data->>'atfNumber',
       'temporaryNumber',j.data->>'temporaryNumber',
       'number',j.data->>'number','sourceType',v_source_type,
       'sourceId',p_document_id,'reason','source_draft_delete'));
   DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection='journalLineDimensions' AND data->>'voucherId'=v_journal_id;
   DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection='journalLines' AND data->>'voucherId'=v_journal_id;
   DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection='journalVouchers' AND id=v_journal_id;
 END IF;

 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection=p_collection AND id=p_document_id;

 RETURN jsonb_build_object('deleted',true,'collection',p_collection,
   'documentId',p_document_id,'journalVoucherId',coalesce(v_journal_id,''),
   'atfNumber',src.data->>'atfNumber');
END $fn$;

REVOKE ALL ON FUNCTION public.finora_document_delete_draft(uuid,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_document_delete_draft(uuid,text,text,bigint) TO authenticated;

-- Prevent the generic CAS endpoint from bypassing the lifecycle contract.
CREATE OR REPLACE FUNCTION public.finora_sync_records_v2(
 p_upserts jsonb DEFAULT '[]'::jsonb, p_deletes jsonb DEFAULT '[]'::jsonb,
 p_organization_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
 v_uid uuid:=auth.uid();
 v_x jsonb; v_collection text; v_id text; v_data jsonb;
 v_expected bigint; v_new bigint;
 v_saved jsonb:='[]'::jsonb; v_deleted jsonb:='[]'::jsonb;
BEGIN
 IF v_uid IS NULL OR v_org IS NULL OR v_org NOT IN (SELECT private.current_organization_ids()) THEN
  RAISE EXCEPTION 'FINORA_UNAUTHORIZED_ORGANIZATION' USING ERRCODE='42501';
 END IF;
 IF NOT private.organization_has_module_entitlement(v_org,'core',true) THEN
  RAISE EXCEPTION 'FINORA_LICENSE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(coalesce(p_upserts,'[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_deletes,'[]'::jsonb))<>'array' THEN
  RAISE EXCEPTION 'FINORA_SYNC_INPUT_INVALID' USING ERRCODE='22023';
 END IF;
 FOR v_x IN SELECT value FROM jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb))
   ORDER BY value->>'collection',value->>'id' LOOP
  v_collection:=v_x->>'collection';v_id:=v_x->>'id';v_data:=v_x->'data';
  IF jsonb_typeof(v_x->'expected_version')<>'number'
     OR coalesce(v_x->>'expected_version','') !~ '^(0|[1-9][0-9]{0,17})$'
     OR jsonb_typeof(v_data)<>'object' OR v_collection IS NULL OR v_id IS NULL THEN
   RAISE EXCEPTION 'FINORA_EXPECTED_VERSION_REQUIRED' USING ERRCODE='22023';
  END IF;
  v_expected:=(v_x->>'expected_version')::bigint;
  IF NOT private.organization_has_module_entitlement(v_org,private.collection_module(v_collection),true) THEN
   RAISE EXCEPTION 'FINORA_MODULE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  v_new:=NULL;
  IF v_expected=0 THEN
    INSERT INTO public.records(organization_id,owner_id,collection,id,data)
    VALUES(v_org,v_uid,v_collection,v_id,v_data)
    ON CONFLICT (organization_id,collection,id) DO NOTHING RETURNING version INTO v_new;
  ELSE
    UPDATE public.records SET data=v_data
    WHERE organization_id=v_org AND collection=v_collection AND id=v_id AND version=v_expected
    RETURNING version INTO v_new;
  END IF;
  IF v_new IS NULL THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT: reload and reconcile' USING ERRCODE='40001'; END IF;
  v_saved:=v_saved||jsonb_build_array(jsonb_build_object('collection',v_collection,'id',v_id,'version',v_new));
 END LOOP;

 FOR v_x IN SELECT value FROM jsonb_array_elements(coalesce(p_deletes,'[]'::jsonb))
   ORDER BY value->>'collection',value->>'id' LOOP
  v_collection:=v_x->>'collection';v_id:=v_x->>'id';
  IF v_collection IN ('journalVouchers','invoices','purchases') THEN
    RAISE EXCEPTION 'FINORA_DOCUMENT_DELETE_VIA_RPC: use the document lifecycle RPC' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(v_x->'expected_version')<>'number'
     OR coalesce(v_x->>'expected_version','') !~ '^[1-9][0-9]{0,17}$' THEN
   RAISE EXCEPTION 'FINORA_EXPECTED_VERSION_REQUIRED' USING ERRCODE='22023';
  END IF;
  v_expected:=(v_x->>'expected_version')::bigint;
  IF NOT private.organization_has_module_entitlement(v_org,private.collection_module(v_collection),true) THEN
   RAISE EXCEPTION 'FINORA_MODULE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.records
  WHERE organization_id=v_org AND collection=v_collection AND id=v_id AND version=v_expected
  RETURNING version INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT: reload and reconcile' USING ERRCODE='40001'; END IF;
  v_deleted:=v_deleted||jsonb_build_array(jsonb_build_object('collection',v_collection,'id',v_id));
 END LOOP;
 RETURN jsonb_build_object('upserts',v_saved,'deletes',v_deleted);
END $fn$;

REVOKE ALL ON FUNCTION private.finora_next_document_atf(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_next_document_temp(uuid,text) FROM PUBLIC,anon,authenticated;