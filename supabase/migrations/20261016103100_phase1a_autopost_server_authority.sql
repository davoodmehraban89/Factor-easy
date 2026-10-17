-- Server derives and rechecks every posted source line at the CAS transition.
CREATE OR REPLACE FUNCTION private.finora_phase1a_line_set(lines jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $f$
DECLARE v jsonb; result jsonb;
BEGIN
 IF jsonb_typeof(lines) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'FINORA_POSTING_LINES_MISMATCH' USING ERRCODE='23514';END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(lines) LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object'
   OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v) key)
    IS DISTINCT FROM ARRAY['accountId','credit','debit']::text[] THEN
   RAISE EXCEPTION 'FINORA_POSTING_LINES_MISMATCH' USING ERRCODE='23514';END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb) INTO result
 FROM jsonb_array_elements(lines);
 RETURN result;
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_revalidate_autopost(org uuid,v public.records)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE typ text:=v.data->>'sourceType';s public.records%rowtype;
 version bigint;expected jsonb;actual jsonb;coll text;
BEGIN
 IF typ NOT IN ('sale','purchase') THEN RETURN;END IF;
 IF v.data->>'postingContractRule' IS DISTINCT FROM typ||'-v1'
  OR coalesce(v.data->>'postingContractVersion','') !~ '^[1-9][0-9]{0,15}$' THEN
  RAISE EXCEPTION 'FINORA_POSTING_CONTRACT_CHANGED' USING ERRCODE='40001';END IF;
 version:=(v.data->>'postingContractVersion')::bigint;
 coll:=CASE WHEN typ='sale' THEN 'invoices' ELSE 'purchases' END;
 SELECT * INTO s FROM public.records WHERE organization_id=org AND collection=coll
 AND id=v.data->>'sourceId' AND data->>'companyId'=v.data->>'companyId' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_SOURCE_NOT_COMMITTED_IN_ORG' USING ERRCODE='23503';END IF;
 IF coalesce(s.data->>'accountingVersion','1') IS DISTINCT FROM v.data->>'sourceVersion' THEN
  RAISE EXCEPTION 'FINORA_SOURCE_TYPE_OR_VERSION_MISMATCH' USING ERRCODE='23514';END IF;
 expected:=private.finora_phase1a_expected_lines(
  org,v.data->>'companyId',typ,s.data,version);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'accountId',data->>'accountId','debit',(data->>'debit')::numeric,'credit',(data->>'credit')::numeric)
  ORDER BY (jsonb_build_object('accountId',data->>'accountId',
  'debit',(data->>'debit')::numeric,'credit',(data->>'credit')::numeric))::text),'[]'::jsonb)
 INTO actual FROM public.records WHERE organization_id=org AND collection='journalLines'
 AND data->>'voucherId'=v.id;
 IF actual IS DISTINCT FROM private.finora_phase1a_line_set(expected) THEN
  RAISE EXCEPTION 'FINORA_POSTING_LINES_MISMATCH' USING ERRCODE='23514';END IF;
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_post_core(
 p_org uuid,p_id text,p_expected_version bigint,p_auto boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;v_fy text;v_company text;v_src text;v_original_src text;
 v_no bigint;v_actor uuid:=auth.uid();v_at timestamptz:=clock_timestamp();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members
 WHERE organization_id=p_org AND user_id=v_actor AND status='active') THEN
  RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v FROM public.records WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_JOURNAL_NOT_FOUND' USING ERRCODE='23503';END IF;
 v_fy:=v.data->>'fiscalYearId';v_company:=v.data->>'companyId';v_src:=coalesce(v.data->>'sourceType','manual');
 IF p_auto THEN
  IF v_src='reversal' THEN
   SELECT data->>'sourceType' INTO v_original_src FROM public.records
    WHERE organization_id=p_org AND collection='journalVouchers' AND id=v.data->>'sourceId';
   IF coalesce(v_original_src,'manual')='manual' THEN
    PERFORM private.finora_phase1a_authorize(p_org,'approve',NULL);
   ELSE
    PERFORM private.finora_phase1a_authorize(p_org,'create',v_original_src);
   END IF;
  ELSIF v_src IN ('manual','') THEN
    RAISE EXCEPTION 'FINORA_INVALID_AUTOMATIC_SOURCE' USING ERRCODE='42501';
  ELSE
   PERFORM private.finora_phase1a_authorize(p_org,'create',v_src);
  END IF;
 ELSE
  PERFORM private.finora_phase1a_authorize(p_org,'approve',NULL);
 END IF;
 IF v.data->>'status'='posted' THEN
  RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version),'replayed',true);
 END IF;
 IF v.data->>'status'<>'draft' THEN RAISE EXCEPTION 'FINORA_JOURNAL_NOT_DRAFT' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF v_src IN ('sale','purchase') THEN
  PERFORM private.finora_phase1a_revalidate_autopost(p_org,v);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records fy
  WHERE fy.organization_id=p_org AND fy.collection='fiscalYears'
  AND fy.id=v_fy AND fy.data->>'companyId'=v_company
  AND coalesce(fy.data->>'status','open')<>'locked') THEN
  RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED_OR_MISSING' USING ERRCODE='23514';
 END IF;
 PERFORM private.finora_phase1a_validate_saved(p_org,p_id,v_company);
 -- First lock the persisted fiscal-year counter; only the first posting
 -- initializes it from the maximum historic number. This avoids O(N^2)
 -- scanning during a 1000-document batch and retains transactional rollback.
 SELECT last_no INTO v_no FROM private.finora_phase1a_journal_counters
 WHERE organization_id=p_org AND fiscal_year_id=v_fy FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO private.finora_phase1a_journal_counters(organization_id,fiscal_year_id,last_no)
  SELECT p_org,v_fy,coalesce(max((d.data->>'number')::bigint),0)
  FROM public.records d WHERE d.organization_id=p_org
   AND d.collection='journalVouchers' AND d.data->>'fiscalYearId'=v_fy
   AND d.data->>'status' IN ('posted','reversed')
   AND d.data->>'number' ~ '^[0-9]{1,17}$'
  ON CONFLICT (organization_id,fiscal_year_id) DO NOTHING;
  SELECT last_no INTO v_no FROM private.finora_phase1a_journal_counters
  WHERE organization_id=p_org AND fiscal_year_id=v_fy FOR UPDATE;
 END IF;
 v_no:=v_no+1;
 UPDATE private.finora_phase1a_journal_counters SET last_no=v_no
 WHERE organization_id=p_org AND fiscal_year_id=v_fy;
 UPDATE public.records SET data=v.data||jsonb_build_object(
  'status','posted','number',v_no::text,'postedAt',v_at,
  'postedBy',v_actor)
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id
 RETURNING * INTO v;
 PERFORM private.finora_phase1a_audit_event(p_org,p_id,v_actor,'posted','',
    jsonb_build_object('number',v_no,'sourceType',v_src,'sourceId',v.data->>'sourceId'));
 RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version),'replayed',false);
END $fn$;


-- The source must be persisted; client lines are comparison-only.
CREATE OR REPLACE FUNCTION public.finora_journal_autopost(
 p_organization_id uuid,p_voucher_id text,p_source_collection text,
 p_source_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE typ text:=p_header->>'sourceType';coll text;source public.records%rowtype;
 cfg_version bigint;lines jsonb;draft jsonb;posted jsonb;voucher public.records%rowtype;
 prior public.records%rowtype;
BEGIN
 IF typ NOT IN ('sale','purchase') THEN
  RAISE EXCEPTION 'FINORA_AUTOPOST_CONTRACT_UNSUPPORTED' USING ERRCODE='23514';END IF;
 coll:=CASE WHEN typ='sale' THEN 'invoices' ELSE 'purchases' END;
 IF p_source_collection IS DISTINCT FROM coll OR coalesce(p_source_id,'')=''
 OR p_header->>'sourceId' IS DISTINCT FROM p_source_id
 OR p_header ?| ARRAY['status','number','postedAt','postedBy',
  'postingContractVersion','postingContractRule'] THEN
  RAISE EXCEPTION 'FINORA_SOURCE_IDENTITY_INVALID' USING ERRCODE='23514';END IF;
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',typ);
 SELECT * INTO source FROM public.records WHERE organization_id=p_organization_id
 AND collection=coll AND id=p_source_id
 AND data->>'companyId'=p_header->>'companyId'
 AND private.can_access_record(p_organization_id,coll,owner_id,data,'create') FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'FINORA_SOURCE_NOT_COMMITTED_IN_ORG' USING ERRCODE='23503';END IF;
 IF (typ='sale' AND source.data->>'kind' NOT IN ('formal','non_formal'))
 OR coalesce(source.data->>'accountingVersion','1')
 IS DISTINCT FROM coalesce(p_header->>'sourceVersion','1') THEN
  RAISE EXCEPTION 'FINORA_SOURCE_TYPE_OR_VERSION_MISMATCH' USING ERRCODE='23514';END IF;
 SELECT * INTO prior FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalVouchers' AND data->>'sourceType'=typ
 AND data->>'sourceId'=p_source_id
 AND data->>'sourceVersion'=coalesce(p_header->>'sourceVersion','1')
 AND data->>'status' IN ('posted','reversed') LIMIT 1 FOR SHARE;
 IF FOUND THEN RETURN jsonb_build_object('voucher',prior.data||
  jsonb_build_object('id',prior.id,'version',prior.version),
  'replayed',true,'draftReplayed',true);END IF;
 SELECT max(version) INTO cfg_version FROM private.finora_phase1a_account_role_snapshots
 WHERE organization_id=p_organization_id AND company_id=p_header->>'companyId' AND approved;
 IF cfg_version IS NULL THEN RAISE EXCEPTION
  'FINORA_POSTING_ACCOUNT_ROLE_MISSING: حساب نقش ثبت خودکار تعریف نشده است'
  USING ERRCODE='23514';END IF;
 lines:=private.finora_phase1a_expected_lines(
  p_organization_id,p_header->>'companyId',typ,source.data,cfg_version);
 IF p_lines IS NOT NULL AND p_lines<>'[]'::jsonb
  AND private.finora_phase1a_line_set(p_lines)
    IS DISTINCT FROM private.finora_phase1a_line_set(lines) THEN
  RAISE EXCEPTION 'FINORA_POSTING_LINES_MISMATCH' USING ERRCODE='23514';END IF;
 draft:=private.finora_phase1a_create_core(
  p_organization_id,p_voucher_id,p_header,lines);
 IF coalesce((draft->>'replayed')::boolean,false)=false THEN
  UPDATE public.records SET data=data||jsonb_build_object(
   'postingContractRule',typ||'-v1','postingContractVersion',cfg_version)
  WHERE organization_id=p_organization_id AND collection='journalVouchers'
  AND id=p_voucher_id RETURNING * INTO voucher;
 ELSE
  SELECT * INTO voucher FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
  IF voucher.data->>'postingContractVersion' IS DISTINCT FROM cfg_version::text
   OR voucher.data->>'postingContractRule' IS DISTINCT FROM typ||'-v1' THEN
   RAISE EXCEPTION 'FINORA_POSTING_CONTRACT_CHANGED' USING ERRCODE='40001';END IF;
 END IF;
 posted:=private.finora_phase1a_post_core(
  p_organization_id,p_voucher_id,voucher.version,true);
 RETURN posted||jsonb_build_object('computedLines',lines,'contractVersion',cfg_version,
  'draftReplayed',coalesce((draft->>'replayed')::boolean,false));
END $f$;
REVOKE ALL ON FUNCTION private.finora_phase1a_line_set(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_revalidate_autopost(uuid,public.records) FROM PUBLIC,anon,authenticated;
