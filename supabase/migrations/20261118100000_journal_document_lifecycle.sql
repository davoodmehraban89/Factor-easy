-- Phase 4: universal temporary journal-document lifecycle.
-- Every accounting voucher receives an immutable, never-reused ATF (عطف) number
-- and a temporary document number. Posting changes lifecycle state only; it does
-- not allocate a second identity.
CREATE SEQUENCE IF NOT EXISTS public.finora_journal_atf_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.finora_journal_temp_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.finora_journal_document_registry (
  atf_number bigint PRIMARY KEY,
  organization_id uuid NOT NULL,
  company_id text NOT NULL,
  fiscal_year_id text,
  voucher_id text NOT NULL,
  temporary_number bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('draft','posted','reversed','deleted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  posted_at timestamptz,
  posted_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS finora_jdr_voucher_uq
  ON public.finora_journal_document_registry(organization_id, voucher_id);
CREATE UNIQUE INDEX IF NOT EXISTS finora_jdr_temp_uq
  ON public.finora_journal_document_registry(organization_id, company_id, fiscal_year_id, temporary_number);

CREATE TABLE IF NOT EXISTS public.finora_journal_document_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atf_number bigint NOT NULL,
  organization_id uuid NOT NULL,
  voucher_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('created','posted','reversed','deleted','migrated_to_draft')),
  old_state text,
  new_state text,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text,
  snapshot jsonb
);

CREATE INDEX IF NOT EXISTS finora_jda_atf_idx
  ON public.finora_journal_document_audit(atf_number, occurred_at);

ALTER TABLE public.finora_journal_document_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finora_journal_document_audit ENABLE ROW LEVEL SECURITY;
-- Direct table reads remain disabled; access is exposed only through SECURITY DEFINER RPCs.
REVOKE ALL ON public.finora_journal_document_registry FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.finora_journal_document_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finora_journal_allocate_identity(
  p_organization_id uuid,
  p_company_id text,
  p_fiscal_year_id text,
  p_voucher_id text,
  p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_existing public.finora_journal_document_registry%rowtype;
  v_atf bigint;
  v_temp bigint;
BEGIN
  PERFORM private.finora_phase1a_authorize(p_organization_id,'create','journalVoucher');

  SELECT * INTO v_existing
  FROM public.finora_journal_document_registry
  WHERE organization_id=p_organization_id AND voucher_id=p_voucher_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'atfNumber',v_existing.atf_number,
      'temporaryNumber',v_existing.temporary_number,
      'state',v_existing.state
    );
  END IF;

  v_atf:=nextval('public.finora_journal_atf_seq');
  v_temp:=nextval('public.finora_journal_temp_seq');

  INSERT INTO public.finora_journal_document_registry(
    atf_number,organization_id,company_id,fiscal_year_id,voucher_id,
    temporary_number,state,created_by
  ) VALUES (
    v_atf,p_organization_id,p_company_id,p_fiscal_year_id,p_voucher_id,
    v_temp,'draft',p_actor
  );

  INSERT INTO public.finora_journal_document_audit(
    atf_number,organization_id,voucher_id,action,old_state,new_state,actor_id,snapshot
  ) VALUES (
    v_atf,p_organization_id,p_voucher_id,'created',NULL,'draft',p_actor,
    jsonb_build_object('companyId',p_company_id,'fiscalYearId',p_fiscal_year_id,
      'temporaryNumber',v_temp)
  );

  RETURN jsonb_build_object(
    'atfNumber',v_atf,'temporaryNumber',v_temp,'state','draft'
  );
END $$;

CREATE OR REPLACE FUNCTION public.finora_journal_post_identity(
  p_organization_id uuid,
  p_voucher_id text,
  p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.finora_journal_document_registry%rowtype;
BEGIN
  PERFORM private.finora_phase1a_authorize(p_organization_id,'create','journalVoucher');
  SELECT * INTO v FROM public.finora_journal_document_registry
  WHERE organization_id=p_organization_id AND voucher_id=p_voucher_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_ATF_NOT_FOUND' USING ERRCODE='23503'; END IF;
  IF v.state='deleted' THEN RAISE EXCEPTION 'FINORA_ATF_DELETED' USING ERRCODE='23514'; END IF;
  IF v.state='posted' THEN
    RETURN jsonb_build_object('atfNumber',v.atf_number,'temporaryNumber',v.temporary_number,'state','posted');
  END IF;
  UPDATE public.finora_journal_document_registry
  SET state='posted',posted_at=clock_timestamp(),posted_by=p_actor
  WHERE atf_number=v.atf_number;
  INSERT INTO public.finora_journal_document_audit(
    atf_number,organization_id,voucher_id,action,old_state,new_state,actor_id
  ) VALUES (v.atf_number,p_organization_id,p_voucher_id,'posted','draft','posted',p_actor);
  RETURN jsonb_build_object('atfNumber',v.atf_number,'temporaryNumber',v.temporary_number,'state','posted');
END $$;

CREATE OR REPLACE FUNCTION public.finora_journal_delete_identity(
  p_organization_id uuid,
  p_voucher_id text,
  p_reason text,
  p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.finora_journal_document_registry%rowtype;
BEGIN
  PERFORM private.finora_phase1a_authorize(p_organization_id,'delete','journalVoucher');
  IF coalesce(trim(p_reason),'')='' THEN
    RAISE EXCEPTION 'FINORA_DELETE_REASON_REQUIRED' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v FROM public.finora_journal_document_registry
  WHERE organization_id=p_organization_id AND voucher_id=p_voucher_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_ATF_NOT_FOUND' USING ERRCODE='23503'; END IF;
  IF v.state IN ('posted','reversed') THEN
    RAISE EXCEPTION 'FINORA_POSTED_DOCUMENT_NOT_DELETABLE'
      USING ERRCODE='23514',
      DETAIL='اسناد قطعی/برگشتی حذف فیزیکی نمی‌شوند؛ از ابطال/برگشت استفاده کنید.';
  END IF;
  IF v.state='deleted' THEN
    RETURN jsonb_build_object('atfNumber',v.atf_number,'temporaryNumber',v.temporary_number,'state','deleted');
  END IF;

  UPDATE public.finora_journal_document_registry
  SET state='deleted',deleted_at=clock_timestamp(),deleted_by=p_actor,delete_reason=trim(p_reason)
  WHERE atf_number=v.atf_number;

  INSERT INTO public.finora_journal_document_audit(
    atf_number,organization_id,voucher_id,action,old_state,new_state,actor_id,reason
  ) VALUES (v.atf_number,p_organization_id,p_voucher_id,'deleted','draft','deleted',p_actor,trim(p_reason));

  RETURN jsonb_build_object(
    'atfNumber',v.atf_number,'temporaryNumber',v.temporary_number,'state','deleted'
  );
END $$;

-- Existing vouchers are deliberately migrated to draft. Their old lifecycle is
-- preserved in the audit table so no historical identity disappears.
DO $$
DECLARE r record; atf bigint; tmp bigint;
BEGIN
  FOR r IN
    SELECT organization_id,id,data
    FROM public.records
    WHERE collection='journalVouchers'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.finora_journal_document_registry x
      WHERE x.organization_id=r.organization_id AND x.voucher_id=r.id
    ) THEN
      atf:=nextval('public.finora_journal_atf_seq');
      tmp:=nextval('public.finora_journal_temp_seq');
      INSERT INTO public.finora_journal_document_registry(
        atf_number,organization_id,company_id,fiscal_year_id,voucher_id,
        temporary_number,state,created_at,created_by
      ) VALUES (
        atf,r.organization_id,coalesce(r.data->>'companyId',''),r.data->>'fiscalYearId',
        r.id,tmp,'draft',coalesce((r.data->>'createdAt')::timestamptz,clock_timestamp()),
        nullif(r.data->>'createdBy','')::uuid
      );
      INSERT INTO public.finora_journal_document_audit(
        atf_number,organization_id,voucher_id,action,old_state,new_state,actor_id,reason,snapshot
      ) VALUES (
        atf,r.organization_id,r.id,'migrated_to_draft',r.data->>'status','draft',
        auth.uid(),'مهاجرت چرخه اسناد به حالت موقت',r.data
      );
      UPDATE public.records
      SET data=(data-'postedAt'-'postedBy'-'reversalVoucherId'-'reversedAt')
        ||jsonb_build_object(
          'status','draft',
          'documentStatus','draft',
          'accountingStatus','draft',
          'atfNumber',atf,
          'temporaryNumber',tmp,
          'numberStatus','temporary'
        ),
        version=version+1
      WHERE organization_id=r.organization_id AND collection='journalVouchers' AND id=r.id;
    END IF;
  END LOOP;

  -- Any commercial source previously linked to a posted journal becomes a
  -- draft source as well; the voucher identity remains linked and traceable.
  UPDATE public.records s
  SET data=(s.data-'accountingPostedAt'-'documentPostedAt'-'documentPostedBy')
      ||jsonb_build_object('documentStatus','draft','accountingStatus','draft'),
      version=s.version+1
  WHERE s.collection IN ('invoices','purchases')
    AND (s.data->>'journalVoucherId') IS NOT NULL
    AND coalesce(s.data->>'accountingStatus','')='posted';
END $$;

REVOKE ALL ON FUNCTION public.finora_journal_allocate_identity(uuid,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_allocate_identity(uuid,text,text,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finora_journal_post_identity(uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_post_identity(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finora_journal_delete_identity(uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_delete_identity(uuid,text,text,uuid) TO authenticated;


-- Create a source-linked draft without posting it. This is the new default
-- lifecycle for sales/purchases: source + accounting voucher are both temporary
-- until an authorized approver posts the voucher.
CREATE OR REPLACE FUNCTION public.finora_journal_create_source_draft(
 p_organization_id uuid,p_voucher_id text,p_source_collection text,
 p_source_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE typ text:=p_header->>'sourceType';
 coll text:=CASE WHEN typ='sale' THEN 'invoices' WHEN typ='purchase' THEN 'purchases' ELSE NULL END;
 source public.records%rowtype; cfg_version bigint; lines jsonb; draft jsonb; voucher public.records%rowtype;
 prior public.records%rowtype;
BEGIN
 IF coll IS NULL OR p_source_collection IS DISTINCT FROM coll
  OR coalesce(p_source_id,'')='' OR p_header->>'sourceId' IS DISTINCT FROM p_source_id THEN
  RAISE EXCEPTION 'FINORA_SOURCE_IDENTITY_INVALID' USING ERRCODE='23514';
 END IF;
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',typ);

 SELECT * INTO source FROM public.records
 WHERE organization_id=p_organization_id AND collection=coll AND id=p_source_id
   AND data->>'companyId'=p_header->>'companyId'
   AND private.can_access_record(p_organization_id,coll,owner_id,data,'create')
 FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'FINORA_SOURCE_NOT_COMMITTED_IN_ORG' USING ERRCODE='23503';
 END IF;

 IF coalesce(source.data->>'journalVoucherId','')<>'' THEN
  SELECT * INTO prior FROM public.records
  WHERE organization_id=p_organization_id AND collection='journalVouchers'
    AND id=source.data->>'journalVoucherId' FOR SHARE;
  IF FOUND AND prior.data->>'sourceType'=typ
     AND prior.data->>'sourceId'=p_source_id
     AND prior.data->>'status'='draft' THEN
    RETURN jsonb_build_object('voucher',prior.data||jsonb_build_object('id',prior.id,'version',prior.version),'replayed',true);
  END IF;
  RAISE EXCEPTION 'FINORA_SOURCE_ALREADY_LINKED' USING ERRCODE='23514';
 END IF;

 SELECT max(version) INTO cfg_version
 FROM private.finora_phase1a_account_role_snapshots
 WHERE organization_id=p_organization_id
   AND company_id=p_header->>'companyId' AND approved;
 IF cfg_version IS NULL THEN
  RAISE EXCEPTION 'FINORA_POSTING_ACCOUNT_ROLE_MISSING: حساب نقش ثبت خودکار تعریف نشده است'
    USING ERRCODE='23514';
 END IF;

 lines:=private.finora_phase1a_expected_lines(
  p_organization_id,p_header->>'companyId',typ,source.data,cfg_version);

 IF p_lines IS NOT NULL AND p_lines<>'[]'::jsonb
  AND private.finora_phase1a_line_set(p_lines)
    IS DISTINCT FROM private.finora_phase1a_line_set(lines) THEN
  RAISE EXCEPTION 'FINORA_POSTING_LINES_MISMATCH' USING ERRCODE='23514';
 END IF;

 draft:=private.finora_phase1a_create_core(
  p_organization_id,p_voucher_id,
  p_header||jsonb_build_object(
    'sourceType',typ,'sourceId',p_source_id,
    'sourceVersion',coalesce(p_header->>'sourceVersion','1')),
  lines);

 UPDATE public.records
 SET data=data||jsonb_build_object(
   'postingContractRule',typ||'-v1',
   'postingContractVersion',cfg_version,
   'documentStatus','draft',
   'accountingStatus','draft')
 WHERE organization_id=p_organization_id
   AND collection='journalVouchers' AND id=p_voucher_id
 RETURNING * INTO voucher;

 UPDATE public.records
 SET data=(data-'accountingPostingPending'-'accountingPostingPendingAt')||
   jsonb_build_object(
     'journalVoucherId',p_voucher_id,
     'accountingStatus','draft',
     'documentStatus','draft',
     'updatedAt',clock_timestamp())
 WHERE organization_id=p_organization_id
   AND collection=coll AND id=p_source_id;

 RETURN jsonb_build_object(
   'voucher',voucher.data||jsonb_build_object('id',voucher.id,'version',voucher.version),
   'replayed',coalesce((draft->>'replayed')::boolean,false),
   'computedLines',lines,'contractVersion',cfg_version);
END $fn$;

REVOKE ALL ON FUNCTION public.finora_journal_create_source_draft(uuid,text,text,text,jsonb,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_create_source_draft(uuid,text,text,text,jsonb,jsonb)
 TO authenticated;

-- Enforce identity/state transitions at the records boundary so every writer
-- (UI, sync, RPC or migration) receives the same lifecycle semantics.
CREATE OR REPLACE FUNCTION public.finora_journal_document_lifecycle_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_identity jsonb;
  v_org uuid;
  v_company text;
  v_fy text;
  v_source_collection text;
  v_source_id text;
BEGIN
  IF TG_OP='INSERT' AND NEW.collection='journalVouchers' THEN
    v_org:=NEW.organization_id;
    v_company:=coalesce(NEW.data->>'companyId','');
    v_fy:=NEW.data->>'fiscalYearId';

    IF coalesce(NEW.data->>'status','draft') <> 'draft' THEN
      NEW.data:=jsonb_set(NEW.data,'{status}','"draft"',true);
    END IF;
    NEW.data:=jsonb_set(NEW.data,'{documentStatus}','"draft"',true);
    NEW.data:=jsonb_set(NEW.data,'{accountingStatus}','"draft"',true);
    NEW.data:=jsonb_set(NEW.data,'{numberStatus}','"temporary"',true);

    v_identity:=public.finora_journal_allocate_identity(
      v_org,v_company,v_fy,NEW.id,auth.uid()
    );
    NEW.data:=NEW.data
      ||jsonb_build_object(
        'atfNumber',(v_identity->>'atfNumber')::bigint,
        'temporaryNumber',(v_identity->>'temporaryNumber')::bigint
      );
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE' AND OLD.collection='journalVouchers' THEN
    -- ATF and temporary number are immutable identities.
    IF OLD.data->>'atfNumber' IS NOT NULL
       AND NEW.data->>'atfNumber' IS DISTINCT FROM OLD.data->>'atfNumber' THEN
      RAISE EXCEPTION 'FINORA_ATF_IMMUTABLE' USING ERRCODE='23514';
    END IF;
    IF OLD.data->>'temporaryNumber' IS NOT NULL
       AND NEW.data->>'temporaryNumber' IS DISTINCT FROM OLD.data->>'temporaryNumber' THEN
      RAISE EXCEPTION 'FINORA_TEMP_NUMBER_IMMUTABLE' USING ERRCODE='23514';
    END IF;

    IF coalesce(OLD.data->>'status','draft')='draft'
       AND coalesce(NEW.data->>'status','draft')='posted' THEN
      PERFORM public.finora_journal_post_identity(NEW.organization_id,NEW.id,auth.uid());
      NEW.data:=NEW.data
        ||jsonb_build_object('documentStatus','posted','accountingStatus','posted',
          'numberStatus','posted');
    END IF;

    IF coalesce(OLD.data->>'status','draft') IN ('posted','reversed') THEN
      IF (OLD.data - ARRAY[
        'status','documentStatus','accountingStatus','numberStatus',
        'postedAt','postedBy','reversalVoucherId','reversedAt'
      ]::text[]) IS DISTINCT FROM
         (NEW.data - ARRAY[
        'status','documentStatus','accountingStatus','numberStatus',
        'postedAt','postedBy','reversalVoucherId','reversedAt'
      ]::text[]) THEN
        RAISE EXCEPTION 'FINORA_POSTED_VOUCHER_IMMUTABLE' USING ERRCODE='23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP='DELETE' AND OLD.collection='journalVouchers' THEN
    PERFORM public.finora_journal_delete_identity(
      OLD.organization_id,OLD.id,'حذف سند موقت توسط کاربر',auth.uid()
    );

    -- Delete the source in the same transaction. Recursive trigger depth is
    -- intentionally ignored so the second side does not delete twice.
    IF pg_trigger_depth()=1
       AND coalesce(OLD.data->>'status','draft')='draft' THEN
      v_source_collection:=CASE OLD.data->>'sourceType'
        WHEN 'sale' THEN 'invoices'
        WHEN 'purchase' THEN 'purchases'
        ELSE NULL END;
      v_source_id:=OLD.data->>'sourceId';
      IF v_source_collection IS NOT NULL AND coalesce(v_source_id,'')<>'' THEN
        DELETE FROM public.records
        WHERE organization_id=OLD.organization_id
          AND collection=v_source_collection
          AND id=v_source_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP='DELETE' AND OLD.collection IN ('invoices','purchases') THEN
    IF pg_trigger_depth()=1
       AND coalesce(OLD.data->>'documentStatus','draft')='draft'
       AND coalesce(OLD.data->>'journalVoucherId','')<>'' THEN
      DELETE FROM public.records
      WHERE organization_id=OLD.organization_id
        AND collection='journalVouchers'
        AND id=OLD.data->>'journalVoucherId';
    END IF;
    RETURN OLD;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS finora_journal_document_lifecycle_trg ON public.records;
CREATE TRIGGER finora_journal_document_lifecycle_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.finora_journal_document_lifecycle_trigger();

REVOKE ALL ON FUNCTION public.finora_journal_document_lifecycle_trigger() FROM PUBLIC, anon, authenticated;
