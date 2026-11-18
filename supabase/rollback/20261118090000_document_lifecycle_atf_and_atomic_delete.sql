-- Conservative rollback for 20261118090000_document_lifecycle_atf_and_atomic_delete.sql.
DROP TRIGGER IF EXISTS trg_finora_stamp_source_document_identity ON public.records;
DROP FUNCTION IF EXISTS private.finora_stamp_source_document_identity();
DROP INDEX IF EXISTS public.ux_finora_document_atf_journal;
DROP INDEX IF EXISTS public.idx_finora_document_atf_source;
DROP TABLE IF EXISTS private.finora_document_temp_counters;
DROP TABLE IF EXISTS private.finora_document_atf_counters;

CREATE OR REPLACE FUNCTION private.finora_phase1a_create_core(
 p_org uuid,p_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_fy text:=p_header->>'fiscalYearId';
 v_company text:=p_header->>'companyId';v_date text:=p_header->>'date';
 v_src text:=coalesce(p_header->>'sourceType','manual');
 v_fp text:=md5(jsonb_build_object('header',p_header,'lines',p_lines)::text);
 v_existing public.records%rowtype; v_current public.records%rowtype;
BEGIN
 IF v_actor IS NULL OR length(coalesce(p_id,''))<5 OR length(p_id)>160
  OR jsonb_typeof(p_header)<>'object' OR p_header ?| array['status','number','postedAt','postedBy','reversedAt','reversalVoucherId']
 THEN RAISE EXCEPTION 'FINORA_DRAFT_INVALID_HEADER' USING ERRCODE='23514';END IF;
 SELECT * INTO v_existing FROM public.records
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id FOR UPDATE;
 IF FOUND THEN
  IF v_existing.data->>'requestFingerprint'=v_fp THEN
   RETURN jsonb_build_object('voucher',v_existing.data||jsonb_build_object('id',v_existing.id,'version',v_existing.version),
    'replayed',true);
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
 INSERT INTO public.records(organization_id,owner_id,collection,id,data)
 VALUES(p_org,v_actor,'journalVouchers',p_id,
   jsonb_build_object('companyId',v_company,'fiscalYearId',v_fy,
    'date',v_date,'description',coalesce(p_header->>'description',''),
    'reference',coalesce(p_header->>'reference',''),
    'voucherType',coalesce(p_header->>'voucherType','manual'),
    'sourceType',v_src,'sourceId',coalesce(p_header->>'sourceId',''),
    'sourceVersion',coalesce(p_header->>'sourceVersion','1'),
    'reversalReason',coalesce(p_header->>'reversalReason',''),
    'reversalAllocations',coalesce(p_header->'reversalAllocations','null'::jsonb),
    'status','draft','createdAt',clock_timestamp(),'createdBy',v_actor,
    'requestFingerprint',v_fp))
 ON CONFLICT (organization_id,collection,id) DO NOTHING;
 -- Two simultaneous requests with the SAME client ID must both resolve to
 -- the SAME draft, never leak a unique-key error or create duplicate lines.
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
   jsonb_build_object('sourceType',v_src));
 SELECT * INTO v_current FROM public.records WHERE organization_id=p_org
 AND collection='journalVouchers' AND id=p_id;
 RETURN jsonb_build_object('voucher',v_current.data||jsonb_build_object('id',p_id,'version',v_current.version),'replayed',false);
END $fn$;

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
 THEN RAISE EXCEPTION 'FINORA_DRAFT_DELETE_FORBIDDEN' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLineDimensions' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLines' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id;
 PERFORM private.finora_phase1a_audit_event(p_organization_id,p_voucher_id,auth.uid(),'draft_deleted','',jsonb_build_object('lastVersion',v.version));
 RETURN jsonb_build_object('deleted',true,'voucherId',p_voucher_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_sync_records(
 p_upserts jsonb, p_deletes jsonb, p_organization_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
BEGIN
 IF current_date>=date '2027-02-01' THEN
    RAISE EXCEPTION 'FINORA_LEGACY_SYNC_EXPIRED' USING ERRCODE='P0001';
 END IF;
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
 IF v_org IS NULL OR v_org NOT IN (SELECT private.current_organization_ids()) THEN
    RAISE EXCEPTION 'organization membership required' USING ERRCODE='42501';
 END IF;
 IF NOT private.organization_has_module_entitlement(v_org,'core',true) THEN
    RAISE EXCEPTION 'active license required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) AS x(collection text,id text,data jsonb)
  WHERE NOT private.organization_has_module_entitlement(v_org,private.collection_module(x.collection),true))
 OR EXISTS(SELECT 1 FROM jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) AS d(collection text,id text)
  WHERE NOT private.organization_has_module_entitlement(v_org,private.collection_module(d.collection),true)) THEN
  RAISE EXCEPTION 'module entitlement required' USING ERRCODE='42501';
 END IF;
 PERFORM private.finora_phase1a_log_legacy_sync(
   CASE WHEN current_setting('finora.phase1a_two_arg_sync',true)='yes' THEN 'two_arg' ELSE 'three_arg' END);
 INSERT INTO public.records(organization_id,owner_id,collection,id,data)
 SELECT v_org,(SELECT auth.uid()),x.collection,x.id,x.data
 FROM jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) AS x(collection text,id text,data jsonb)
 ON CONFLICT (organization_id,collection,id) DO UPDATE SET data=excluded.data;
 DELETE FROM public.records r
 USING jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) AS d(collection text,id text)
 WHERE r.organization_id=v_org AND r.collection=d.collection AND r.id=d.id;
END
$fn$;

-- 2-arg compatibility for older clients. Must remain functional until sunset.
CREATE OR REPLACE FUNCTION public.finora_sync_records(
 p_upserts jsonb DEFAULT '[]'::jsonb,
 p_deletes jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 PERFORM set_config('finora.phase1a_two_arg_sync','yes',true);
 PERFORM public.finora_sync_records(p_upserts,p_deletes,NULL::uuid);
 PERFORM set_config('finora.phase1a_two_arg_sync','no',true);
END
$fn$;

REVOKE ALL ON FUNCTION public.finora_sync_records(jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_sync_records(jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_sync_records(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_sync_records(jsonb,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.finora_sync_records_v2(
 p_upserts jsonb DEFAULT '[]'::jsonb, p_deletes jsonb DEFAULT '[]'::jsonb,
 p_organization_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
 v_uid uuid:=auth.uid();
 v_x jsonb;
 v_collection text;
 v_id text;
 v_data jsonb;
 v_expected bigint;
 v_new bigint;
 v_saved jsonb:='[]'::jsonb;
 v_deleted jsonb:='[]'::jsonb;
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
 FOR v_x IN SELECT value FROM jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb)) ORDER BY value->>'collection',value->>'id' LOOP
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
    IF v_new IS NULL THEN
       RAISE EXCEPTION 'FINORA_VERSION_CONFLICT: reload and reconcile' USING ERRCODE='40001';
    END IF;
    v_saved:=v_saved||jsonb_build_array(jsonb_build_object(
      'collection',v_collection,'id',v_id,'version',v_new));
 END LOOP;
 FOR v_x IN SELECT value FROM jsonb_array_elements(coalesce(p_deletes,'[]'::jsonb)) ORDER BY value->>'collection',value->>'id' LOOP
    v_collection:=v_x->>'collection';v_id:=v_x->>'id';
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
    IF v_new IS NULL THEN
      RAISE EXCEPTION 'FINORA_VERSION_CONFLICT: reload and reconcile' USING ERRCODE='40001';
    END IF;
    v_deleted:=v_deleted||jsonb_build_array(jsonb_build_object('collection',v_collection,'id',v_id));
 END LOOP;
 RETURN jsonb_build_object('upserts',v_saved,'deletes',v_deleted);
END
$fn$;
REVOKE ALL ON FUNCTION public.finora_sync_records_v2(jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_sync_records_v2(jsonb,jsonb,uuid) TO authenticated;
