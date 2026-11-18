-- Document lifecycle v1
-- Contract:
-- 1) Every financial document starts as draft/temporary.
-- 2) ATEF is immutable and never reused, including after deletion.
-- 3) Temporary number may become the permanent number at posting; permanent numbers
--    are allocated server-side and never assigned twice.
-- 4) Draft source + draft accounting voucher are deleted atomically through the
--    source document. Direct deletion of a linked voucher is blocked.
-- 5) Posted documents are not physically deleted; they are reversed/cancelled.
-- 6) Existing financial documents are migrated to draft while preserving their
--    previous state/number in audit metadata.

CREATE TABLE IF NOT EXISTS public.finora_document_number_sequence (
  organization_id uuid PRIMARY KEY,
  next_atef bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.finora_document_lifecycle_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL,
  atef_number bigint NOT NULL,
  document_collection text NOT NULL,
  document_id text NOT NULL,
  event_type text NOT NULL,
  temporary_number text,
  permanent_number text,
  related_collection text,
  related_id text,
  actor_id uuid,
  original_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, atef_number, event_type, document_collection, document_id)
);

CREATE INDEX IF NOT EXISTS finora_document_lifecycle_audit_doc_idx
 ON public.finora_document_lifecycle_audit(organization_id, document_collection, document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS finora_document_lifecycle_audit_atef_idx
 ON public.finora_document_lifecycle_audit(organization_id, atef_number);

CREATE OR REPLACE FUNCTION public.finora_next_atef(p_organization_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE n bigint;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'FINORA_ORGANIZATION_REQUIRED' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('finora-atef:'||p_organization_id::text, 0));
  INSERT INTO public.finora_document_number_sequence(organization_id,next_atef)
  VALUES(p_organization_id,2)
  ON CONFLICT(organization_id) DO UPDATE
    SET next_atef=public.finora_document_number_sequence.next_atef+1,
        updated_at=clock_timestamp()
  RETURNING next_atef-1 INTO n;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.finora_next_permanent_number(
  p_organization_id uuid,
  p_company_id text,
  p_fiscal_year_id text,
  p_document_type text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE n bigint;
BEGIN
  IF p_organization_id IS NULL OR coalesce(p_company_id,'')='' OR coalesce(p_fiscal_year_id,'')='' THEN
    RAISE EXCEPTION 'FINORA_NUMBERING_CONTEXT_REQUIRED' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'finora-permanent-number:'||p_organization_id::text||':'||
    p_company_id||':'||p_fiscal_year_id||':'||coalesce(p_document_type,'journal'),0));
  SELECT coalesce(max(NULLIF(data->>'number','')::bigint),0)+1
    INTO n
  FROM public.records
  WHERE organization_id=p_organization_id
    AND collection IN ('journalVouchers','invoices','purchases','payments','expenses','cheques','contractStatements',
                       'payrollRuns','employeeBenefitAccruals','pettyCashTransactions')
    AND coalesce(data->>'companyId','')=p_company_id
    AND coalesce(data->>'fiscalYearId','')=p_fiscal_year_id
    AND coalesce(data->>'documentType',data->>'sourceType',collection)=coalesce(p_document_type,collection)
    AND coalesce(data->>'status',data->>'documentStatus',data->>'accountingStatus','draft')='posted';
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.finora_next_atef(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finora_next_permanent_number(uuid,text,text,text) FROM PUBLIC, anon, authenticated;

-- Add immutable lifecycle metadata to all existing transactional records.
DO $$
DECLARE r record; v_atef bigint; v_temp text; v_status text;
DECLARE transactional text[] := ARRAY[
 'journalVouchers','invoices','purchases','payments','expenses','cheques',
 'contractStatements','payrollRuns','employeeBenefitAccruals','pettyCashTransactions'
];
BEGIN
  FOR r IN
    SELECT * FROM public.records
    WHERE collection = ANY(transactional)
    ORDER BY organization_id, collection, id
  LOOP
    v_atef := NULLIF(r.data->>'atefNumber','')::bigint;
    IF v_atef IS NULL THEN v_atef := public.finora_next_atef(r.organization_id); END IF;
    v_temp := nullif(trim(coalesce(r.data->>'temporaryNumber',r.data->>'number','')),'');
    IF v_temp IS NULL THEN v_temp := 'TMP-'||v_atef::text; END IF;
    v_status := coalesce(r.data->>'status',r.data->>'documentStatus',r.data->>'accountingStatus','draft');

    UPDATE public.records
    SET data =
      CASE
        WHEN collection='journalVouchers' THEN
          (data
            || jsonb_build_object(
              'atefNumber',v_atef,
              'temporaryNumber',v_temp,
              'lifecycleMigrationOriginalStatus',v_status,
              'lifecycleMigrationOriginalNumber',coalesce(data->>'number',''),
              'status','draft'
            )
            - 'number' - 'postedAt' - 'postedBy')
        ELSE
          (data
            || jsonb_build_object(
              'atefNumber',v_atef,
              'temporaryNumber',v_temp,
              'lifecycleMigrationOriginalStatus',v_status,
              'lifecycleMigrationOriginalNumber',coalesce(data->>'number',''),
              'documentStatus','draft',
              'accountingStatus',CASE WHEN data ? 'accountingStatus' THEN 'draft' ELSE data->>'accountingStatus' END
            )
            - 'number' - 'postedAt' - 'postedBy' - 'accountingPostedAt' - 'documentPostedAt' - 'documentPostedBy')
      END
    WHERE organization_id=r.organization_id AND collection=r.collection AND id=r.id;

    INSERT INTO public.finora_document_lifecycle_audit(
      organization_id,atef_number,document_collection,document_id,event_type,
      temporary_number,permanent_number,actor_id,original_status,metadata)
    VALUES(
      r.organization_id,v_atef,r.collection,r.id,'MIGRATED_TO_DRAFT',
      v_temp,coalesce(r.data->>'number',''),auth.uid(),v_status,
      jsonb_build_object('migration','20261118100000','source_record_version',r.version)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Reconcile the sequence above any pre-existing ATEF values.
UPDATE public.finora_document_number_sequence s
SET next_atef = greatest(
  s.next_atef,
  coalesce((SELECT max((data->>'atefNumber')::bigint)+1
            FROM public.records
            WHERE organization_id=s.organization_id
              AND data ? 'atefNumber'),1)
),
updated_at=clock_timestamp();

-- Server-side creation of a temporary document number. ATEF is allocated once.
CREATE OR REPLACE FUNCTION public.finora_document_identity(
  p_organization_id uuid,
  p_collection text,
  p_id text,
  p_temporary_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.records%rowtype; n bigint; t text;
BEGIN
  SELECT * INTO r FROM public.records
   WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  n:=NULLIF(r.data->>'atefNumber','')::bigint;
  IF n IS NULL THEN n:=public.finora_next_atef(p_organization_id); END IF;
  t:=nullif(trim(coalesce(p_temporary_number,r.data->>'temporaryNumber',r.data->>'number','')),'');
  IF t IS NULL THEN t:='TMP-'||n::text; END IF;
  UPDATE public.records
   SET data=(r.data||jsonb_build_object('atefNumber',n,'temporaryNumber',t,'documentStatus','draft')-'number'-'postedAt'-'postedBy')
   WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id;
  INSERT INTO public.finora_document_lifecycle_audit(
    organization_id,atef_number,document_collection,document_id,event_type,temporary_number,actor_id,metadata)
  VALUES(p_organization_id,n,p_collection,p_id,'CREATED_DRAFT',t,auth.uid(),jsonb_build_object('temporary',true));
  RETURN (SELECT data FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id);
END $$;

-- Posting assigns the permanent number. It never changes ATEF.
CREATE OR REPLACE FUNCTION public.finora_assign_permanent_document_number(
  p_organization_id uuid,
  p_collection text,
  p_id text,
  p_company_id text,
  p_fiscal_year_id text,
  p_document_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.records%rowtype; n bigint; status text;
BEGIN
  SELECT * INTO r FROM public.records
  WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  status:=coalesce(r.data->>'status',r.data->>'documentStatus',r.data->>'accountingStatus','draft');
  IF status<>'posted' THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_POSTED' USING ERRCODE='23514'; END IF;
  n:=public.finora_next_permanent_number(p_organization_id,p_company_id,p_fiscal_year_id,p_document_type);
  UPDATE public.records
   SET data=(r.data||jsonb_build_object('number',n::text,'documentStatus','posted','accountingStatus',
     CASE WHEN r.data ? 'accountingStatus' THEN 'posted' ELSE r.data->>'accountingStatus' END))
   WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id;
  INSERT INTO public.finora_document_lifecycle_audit(
    organization_id,atef_number,document_collection,document_id,event_type,
    temporary_number,permanent_number,actor_id,metadata)
  VALUES(p_organization_id,(r.data->>'atefNumber')::bigint,p_collection,p_id,'POSTED',
    r.data->>'temporaryNumber',n::text,auth.uid(),jsonb_build_object('document_type',p_document_type));
  RETURN (SELECT data FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id);
END $$;

REVOKE ALL ON FUNCTION public.finora_document_identity(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finora_assign_permanent_document_number(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Draft source deletion: source is the user-facing root. If it owns a draft
-- journal voucher, the voucher + lines + dimensions are deleted atomically too.
CREATE OR REPLACE FUNCTION public.finora_delete_draft_source(
  p_organization_id uuid,
  p_collection text,
  p_source_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE s public.records%rowtype; v public.records%rowtype; a bigint;
BEGIN
  SELECT * INTO s FROM public.records
  WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_source_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_SOURCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF coalesce(s.data->>'documentStatus',s.data->>'accountingStatus',s.data->>'status','draft')<>'draft'
     THEN RAISE EXCEPTION 'FINORA_ONLY_DRAFT_CAN_BE_DELETED' USING ERRCODE='23514'; END IF;
  a:=NULLIF(s.data->>'atefNumber','')::bigint;

  IF coalesce(s.data->>'journalVoucherId','')<>'' THEN
    SELECT * INTO v FROM public.records
    WHERE organization_id=p_organization_id AND collection='journalVouchers'
      AND id=s.data->>'journalVoucherId' FOR UPDATE;
    IF FOUND AND coalesce(v.data->>'status','draft')<>'draft'
      THEN RAISE EXCEPTION 'FINORA_LINKED_VOUCHER_NOT_DRAFT' USING ERRCODE='23514'; END IF;

    IF FOUND THEN
      INSERT INTO public.finora_document_lifecycle_audit(
        organization_id,atef_number,document_collection,document_id,event_type,
        temporary_number,permanent_number,related_collection,related_id,actor_id,original_status,metadata)
      VALUES(p_organization_id,a,'journalVouchers',v.id,'DELETED_WITH_SOURCE',
        v.data->>'temporaryNumber',v.data->>'number',p_collection,p_source_id,auth.uid(),'draft',
        jsonb_build_object('source_atef',a));
      DELETE FROM public.records WHERE organization_id=p_organization_id
        AND collection IN ('journalLineDimensions','journalLines')
        AND ((collection='journalLines' AND data->>'voucherId'=v.id)
          OR (collection='journalLineDimensions' AND data->>'voucherId'=v.id));
      DELETE FROM public.records WHERE organization_id=p_organization_id
        AND collection='journalVouchers' AND id=v.id;
    END IF;
  END IF;

  INSERT INTO public.finora_document_lifecycle_audit(
    organization_id,atef_number,document_collection,document_id,event_type,
    temporary_number,permanent_number,actor_id,original_status,metadata)
  VALUES(p_organization_id,a,p_collection,p_source_id,'DELETED',
    s.data->>'temporaryNumber',s.data->>'number',auth.uid(),'draft',
    jsonb_build_object('cascade_voucher_id',s.data->>'journalVoucherId'));

  DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection=p_collection AND id=p_source_id;

  RETURN jsonb_build_object('deleted',true,'atefNumber',a,'sourceId',p_source_id);
END $$;

REVOKE ALL ON FUNCTION public.finora_delete_draft_source(uuid,text,text) FROM PUBLIC, anon, authenticated;

-- Direct deletion of a linked voucher is deliberately forbidden. User must
-- delete the source document; the source operation then removes both.
CREATE OR REPLACE FUNCTION public.finora_delete_draft_voucher(
  p_organization_id uuid,
  p_voucher_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v public.records%rowtype; src public.records%rowtype;
BEGIN
  SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id
    AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_VOUCHER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF coalesce(v.data->>'status','draft')<>'draft' THEN
    RAISE EXCEPTION 'FINORA_ONLY_DRAFT_CAN_BE_DELETED' USING ERRCODE='23514';
  END IF;
  IF coalesce(v.data->>'sourceType','manual') IN ('sale','purchase') AND coalesce(v.data->>'sourceId','')<>'' THEN
    RAISE EXCEPTION 'FINORA_DELETE_SOURCE_REQUIRED: ابتدا سند تجاری منبع را حذف کنید' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection IN ('journalLineDimensions','journalLines')
    AND data->>'voucherId'=p_voucher_id;
  DELETE FROM public.records WHERE organization_id=p_organization_id
    AND collection='journalVouchers' AND id=p_voucher_id;
  INSERT INTO public.finora_document_lifecycle_audit(
    organization_id,atef_number,document_collection,document_id,event_type,
    temporary_number,permanent_number,actor_id,original_status)
  VALUES(p_organization_id,NULL,'journalVouchers',p_voucher_id,'DELETED_DRAFT_VOUCHER',
    v.data->>'temporaryNumber',v.data->>'number',auth.uid(),'draft');
  RETURN jsonb_build_object('deleted',true,'voucherId',p_voucher_id);
END $$;

REVOKE ALL ON FUNCTION public.finora_delete_draft_voucher(uuid,text) FROM PUBLIC, anon, authenticated;

-- Public read policy is intentionally absent; audit is accessed only through a
-- future privileged reporting RPC. The table is not exposed to clients.
