-- Document lifecycle v1
-- Every journal document starts as a draft, receives an immutable attachment number,
-- and only receives its final accounting number when posted.
-- Deleted drafts keep their attachment identity forever in an audit registry.

CREATE SEQUENCE IF NOT EXISTS public.finora_document_attachment_seq AS bigint START WITH 1 INCREMENT BY 1 CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.finora_document_temporary_seq AS bigint START WITH 1 INCREMENT BY 1 CACHE 1;

CREATE TABLE IF NOT EXISTS public.finora_document_identity (
  attachment_no bigint PRIMARY KEY,
  organization_id uuid NOT NULL,
  voucher_id text NOT NULL UNIQUE,
  source_collection text,
  source_id text,
  temporary_number text NOT NULL UNIQUE,
  final_number text,
  status text NOT NULL CHECK (status IN ('draft','posted','reversed','deleted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  finalized_at timestamptz,
  finalized_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS finora_document_identity_org_idx
  ON public.finora_document_identity(organization_id, status);
CREATE INDEX IF NOT EXISTS finora_document_identity_source_idx
  ON public.finora_document_identity(source_collection, source_id);

ALTER TABLE public.finora_document_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finora_document_identity_select ON public.finora_document_identity;
CREATE POLICY finora_document_identity_select ON public.finora_document_identity
FOR SELECT TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION private.finora_document_number_next(p_organization_id uuid, p_fiscal_year_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE n bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_organization_id::text,'')||':'||coalesce(p_fiscal_year_id,''), 0));
  SELECT coalesce(max(NULLIF(regexp_replace(data->>'finalNumber','[^0-9]','','g'),'')::bigint),0)+1
    INTO n
  FROM public.records
  WHERE organization_id=p_organization_id
    AND collection='journalVouchers'
    AND data->>'fiscalYearId'=p_fiscal_year_id
    AND data->>'status'='posted';
  RETURN n::text;
END $$;

CREATE OR REPLACE FUNCTION private.finora_document_identity_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_att bigint;
  v_tmp text;
  v_status text;
  v_source_collection text;
  v_source_id text;
  v_org uuid;
  v_final text;
BEGIN
  IF NEW.collection='journalVouchers' THEN
    v_org:=NEW.organization_id;
    v_status:=coalesce(NEW.data->>'status','draft');

    SELECT attachment_no, temporary_number, source_collection, source_id
      INTO v_att, v_tmp, v_source_collection, v_source_id
    FROM public.finora_document_identity
    WHERE voucher_id=NEW.id
    FOR UPDATE;

    IF v_att IS NULL THEN
      v_att:=nextval('public.finora_document_attachment_seq');
      v_tmp:='TMP-'||nextval('public.finora_document_temporary_seq');
      INSERT INTO public.finora_document_identity
        (attachment_no,organization_id,voucher_id,source_collection,source_id,temporary_number,status,created_by,snapshot)
      VALUES
        (v_att,v_org,NEW.id,
         CASE WHEN NEW.data->>'sourceType'='sale' THEN 'invoices'
              WHEN NEW.data->>'sourceType'='purchase' THEN 'purchases'
              ELSE NULL END,
         nullif(NEW.data->>'sourceId',''),v_tmp,
         CASE WHEN v_status IN ('posted','reversed') THEN 'draft' ELSE 'draft' END,
         auth.uid(),NEW.data);
    END IF;

    NEW.data:=NEW.data
      ||jsonb_build_object('attachmentNumber',v_att::text,'temporaryNumber',v_tmp);

    IF v_status='posted' AND coalesce(OLD.data->>'status','draft')<>'posted' THEN
      v_final:=private.finora_document_number_next(NEW.organization_id,NEW.data->>'fiscalYearId');
      NEW.data:=NEW.data
        ||jsonb_build_object('finalNumber',v_final,'number',v_final,'status','posted');
      UPDATE public.finora_document_identity
      SET final_number=v_final,status='posted',finalized_at=clock_timestamp(),finalized_by=auth.uid(),
          source_collection=CASE WHEN NEW.data->>'sourceType'='sale' THEN 'invoices'
                                 WHEN NEW.data->>'sourceType'='purchase' THEN 'purchases' ELSE source_collection END,
          source_id=nullif(NEW.data->>'sourceId','')
      WHERE voucher_id=NEW.id;
    ELSIF v_status='reversed' THEN
      UPDATE public.finora_document_identity
      SET status='reversed'
      WHERE voucher_id=NEW.id;
    ELSE
      UPDATE public.finora_document_identity
      SET status='draft',
          source_collection=coalesce(source_collection,
            CASE WHEN NEW.data->>'sourceType'='sale' THEN 'invoices'
                 WHEN NEW.data->>'sourceType'='purchase' THEN 'purchases' ELSE NULL END),
          source_id=coalesce(source_id,nullif(NEW.data->>'sourceId',''))
      WHERE voucher_id=NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.finora_document_identity_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE src_collection text; src_id text; v_status text;
BEGIN
  IF OLD.collection='journalVouchers' THEN
    v_status:=coalesce(OLD.data->>'status','draft');
    IF v_status<>'draft' AND current_setting('finora.allow_document_delete',true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'FINORA_DOCUMENT_POSTED_DELETE_FORBIDDEN'
        USING ERRCODE='42501',
              DETAIL='سند قطعی/برگشت‌شده حذف مستقیم ندارد؛ ابتدا از مسیر رسمی اصلاح یا ابطال اقدام کنید.';
    END IF;

    SELECT source_collection,source_id
      INTO src_collection,src_id
    FROM public.finora_document_identity
    WHERE voucher_id=OLD.id;

    IF coalesce(src_id,'')<>'' AND current_setting('finora.cascade_source_delete',true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'FINORA_DELETE_SOURCE_FIRST'
        USING ERRCODE='23514',
              DETAIL='این سند حسابداری از یک سند تجاری/منبع ایجاد شده است؛ ابتدا همان سند منبع را حذف کنید.',
              HINT=coalesce(src_collection,'')||'|'||coalesce(src_id,'');
    END IF;

    UPDATE public.finora_document_identity
    SET status='deleted',deleted_at=clock_timestamp(),deleted_by=auth.uid(),
        deleted_reason=coalesce(current_setting('finora.delete_reason',true),'حذف سند موقت'),
        snapshot=OLD.data
    WHERE voucher_id=OLD.id;
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION private.finora_document_identity_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF OLD.collection='journalVouchers' THEN
    DELETE FROM public.records
    WHERE organization_id=OLD.organization_id AND collection='journalLines'
      AND data->>'voucherId'=OLD.id;
    DELETE FROM public.records
    WHERE organization_id=OLD.organization_id AND collection='journalLineDimensions'
      AND data->>'voucherId'=OLD.id;
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION private.finora_source_delete_cascade_draft_voucher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE vid text; vdata jsonb; vstatus text;
BEGIN
  IF TG_OP='DELETE' AND OLD.collection IN ('invoices','purchases') THEN
    vid:=OLD.data->>'journalVoucherId';
    IF coalesce(vid,'')<>'' THEN
      SELECT data INTO vdata
      FROM public.records
      WHERE organization_id=OLD.organization_id AND collection='journalVouchers' AND id=vid
      FOR UPDATE;
      IF FOUND THEN
        vstatus:=coalesce(vdata->>'status','draft');
        IF vstatus<>'draft' THEN
          RAISE EXCEPTION 'FINORA_SOURCE_POSTED_DELETE_FORBIDDEN'
            USING ERRCODE='42501',
                  DETAIL='سند منبع به سند حسابداری قطعی متصل است؛ حذف مستقیم مجاز نیست.';
        END IF;
        PERFORM set_config('finora.cascade_source_delete','1',true);
        PERFORM set_config('finora.delete_reason','حذف سند منبع و سند حسابداری وابسته',true);
        DELETE FROM public.records
        WHERE organization_id=OLD.organization_id AND collection='journalVouchers' AND id=vid;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS finora_document_identity_before_trg ON public.records;
CREATE TRIGGER finora_document_identity_before_trg
BEFORE INSERT OR UPDATE OF data ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_document_identity_before();

DROP TRIGGER IF EXISTS finora_document_identity_delete_trg ON public.records;
CREATE TRIGGER finora_document_identity_delete_trg
BEFORE DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_document_identity_before_delete();

DROP TRIGGER IF EXISTS finora_document_identity_after_delete_trg ON public.records;
CREATE TRIGGER finora_document_identity_after_delete_trg
AFTER DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_document_identity_after_delete();

DROP TRIGGER IF EXISTS finora_source_delete_cascade_trg ON public.records;
CREATE TRIGGER finora_source_delete_cascade_trg
BEFORE DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_source_delete_cascade_draft_voucher();

-- Backfill identities first.
INSERT INTO public.finora_document_identity
  (attachment_no,organization_id,voucher_id,source_collection,source_id,temporary_number,status,created_by,snapshot)
SELECT nextval('public.finora_document_attachment_seq'),
       r.organization_id,r.id,
       CASE WHEN r.data->>'sourceType'='sale' THEN 'invoices'
            WHEN r.data->>'sourceType'='purchase' THEN 'purchases' ELSE NULL END,
       nullif(r.data->>'sourceId',''),
       'TMP-'||nextval('public.finora_document_temporary_seq'),
       'draft',nullif(r.data->>'createdBy','')::uuid,r.data
FROM public.records r
WHERE r.collection='journalVouchers'
  AND NOT EXISTS (SELECT 1 FROM public.finora_document_identity i WHERE i.voucher_id=r.id);

-- The requested lifecycle starts from draft for every existing voucher.
-- Preserve the previous state for audit; do not silently destroy the fact that it was previously posted.
UPDATE public.records r
SET data=(r.data
  - 'postedAt' - 'postedBy' - 'reversedAt'
  - 'finalNumber'
  || jsonb_build_object(
       'legacyLifecycleStatus',coalesce(r.data->>'status','draft'),
       'legacyPostedAt',r.data->'postedAt',
       'legacyPostedBy',r.data->'postedBy',
       'status','draft',
       'temporaryNumber',i.temporary_number,
       'attachmentNumber',i.attachment_no::text,
       'accountingStatus','draft',
       'documentStatus','draft'))
FROM public.finora_document_identity i
WHERE r.collection='journalVouchers' AND r.id=i.voucher_id
  AND coalesce(r.data->>'status','draft')<>'draft';

UPDATE public.finora_document_identity i
SET status='draft',
    final_number=NULL,
    snapshot=r.data
FROM public.records r
WHERE r.collection='journalVouchers' AND r.id=i.voucher_id;

-- Commercial source documents linked to vouchers enter the same draft lifecycle.
UPDATE public.records r
SET data=(r.data
  - 'accountingPostedAt' - 'documentPostedAt' - 'documentPostedBy' - 'postedAt' - 'postedBy'
  || jsonb_build_object(
       'legacyLifecycleStatus',coalesce(r.data->>'documentStatus',r.data->>'accountingStatus','draft'),
       'status',CASE WHEN r.collection IN ('invoices','purchases') THEN 'draft' ELSE coalesce(r.data->>'status','draft') END,
       'documentStatus','draft',
       'accountingStatus','draft'))
WHERE r.collection IN ('invoices','purchases')
  AND coalesce(r.data->>'journalVoucherId','')<>''
  AND (r.data->>'documentStatus'='posted' OR r.data->>'accountingStatus'='posted');

-- Keep the identity registry in sync with source links after backfill.
UPDATE public.finora_document_identity i
SET source_collection=CASE WHEN r.data->>'sourceType'='sale' THEN 'invoices'
                           WHEN r.data->>'sourceType'='purchase' THEN 'purchases' ELSE i.source_collection END,
    source_id=nullif(r.data->>'sourceId','')
FROM public.records r
WHERE r.collection='journalVouchers' AND r.id=i.voucher_id;

COMMENT ON TABLE public.finora_document_identity IS
'Immutable attachment identity and deletion audit for accounting documents. Attachment numbers are never reused.';
