-- Atomically link the source business record to its posted voucher.
-- No client-side commerce:update permission or second sync transaction is needed.
CREATE OR REPLACE FUNCTION public.finora_journal_autopost(
 p_organization_id uuid,p_voucher_id text,p_source_collection text,
 p_source_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE typ text:=p_header->>'sourceType';coll text;source public.records%rowtype;
 cfg_version bigint;lines jsonb;draft jsonb;posted jsonb;voucher public.records%rowtype;
 prior public.records%rowtype;v_prior_effective_status text;
BEGIN
 IF coalesce(typ,'') NOT IN ('sale','purchase') THEN
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
 AND private.can_access_record(p_organization_id,coll,owner_id,data,'create') FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'FINORA_SOURCE_NOT_COMMITTED_IN_ORG' USING ERRCODE='23503';END IF;
 IF (typ='sale' AND coalesce(source.data->>'kind','') NOT IN ('formal','non_formal'))
 OR coalesce(source.data->>'accountingVersion','1')
 IS DISTINCT FROM coalesce(p_header->>'sourceVersion','1') THEN
  RAISE EXCEPTION 'FINORA_SOURCE_TYPE_OR_VERSION_MISMATCH' USING ERRCODE='23514';END IF;
 -- The client may choose neither an accounting date nor a voucher classification
 -- that differs from the committed source document.
 IF translate(coalesce(source.data->>'date',''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')
      IS DISTINCT FROM
    translate(coalesce(p_header->>'date',''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')
 OR p_header->>'voucherType' IS DISTINCT FROM typ THEN
  RAISE EXCEPTION 'FINORA_SOURCE_HEADER_MISMATCH' USING ERRCODE='23514';END IF;
 SELECT * INTO prior FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalVouchers' AND data->>'sourceType'=typ
 AND data->>'sourceId'=p_source_id
 AND data->>'sourceVersion'=coalesce(p_header->>'sourceVersion','1')
 AND data->>'status' IN ('posted','reversed') LIMIT 1 FOR SHARE;
 IF FOUND THEN
  SELECT effective_status INTO v_prior_effective_status FROM public.finora_journal_reversal_status
   WHERE organization_id=p_organization_id AND voucher_id=prior.id;
  UPDATE public.records r SET data=(r.data-'accountingPostingPending'-'accountingPostingPendingAt')||
   jsonb_build_object('journalVoucherId',prior.id,
    'accountingStatus',CASE WHEN coalesce(v_prior_effective_status,prior.data->>'status')='reversed' THEN 'reversed' ELSE 'posted' END,
    'accountingPostedAt',coalesce(prior.data->>'postedAt',r.data->>'accountingPostedAt'),
    'documentStatus',CASE WHEN coalesce(v_prior_effective_status,prior.data->>'status')='reversed' THEN 'reversed' ELSE 'posted' END,
    'documentPostedAt',coalesce(prior.data->>'postedAt',r.data->>'documentPostedAt'),
    'documentPostedBy',coalesce(prior.data->>'postedBy',r.data->>'documentPostedBy'),
    'documentVersion',coalesce((r.data->>'documentVersion')::integer,1),
    'updatedAt',clock_timestamp())
  WHERE r.organization_id=p_organization_id AND r.collection=coll AND r.id=p_source_id;
  RETURN jsonb_build_object('voucher',prior.data||
   jsonb_build_object('id',prior.id,'version',prior.version),
   'replayed',true,'draftReplayed',true);
 END IF;
 IF coalesce(source.data->>'journalVoucherId','')<>'' THEN
  RAISE EXCEPTION 'FINORA_SOURCE_ALREADY_LINKED' USING ERRCODE='23514';
 END IF;
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
 -- The source link/status and posted journal commit or roll back together.
 UPDATE public.records r SET data=(r.data-'accountingPostingPending'-'accountingPostingPendingAt')||
  jsonb_build_object('journalVoucherId',p_voucher_id,'accountingStatus','posted',
   'accountingPostedAt',posted#>>'{voucher,postedAt}','documentStatus','posted',
   'documentPostedAt',posted#>>'{voucher,postedAt}',
   'documentPostedBy',coalesce(posted#>>'{voucher,postedBy}',auth.uid()::text),
   'documentVersion',coalesce((r.data->>'documentVersion')::integer,1),
   'updatedAt',clock_timestamp())
 WHERE r.organization_id=p_organization_id AND r.collection=coll AND r.id=p_source_id;
 RETURN posted||jsonb_build_object('computedLines',lines,'contractVersion',cfg_version,
  'draftReplayed',coalesce((draft->>'replayed')::boolean,false));
END $f$;
