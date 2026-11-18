-- Security hardening for the lifecycle RPCs.
-- The functions are callable by authenticated users only and delegate tenant/role
-- authorization to the same Phase-1 authorization gate used by journal RPCs.
CREATE OR REPLACE FUNCTION public.finora_document_identity(
  p_organization_id uuid,p_collection text,p_id text,p_temporary_number text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.records%rowtype; n bigint; t text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FINORA_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM private.finora_phase1a_authorize(p_organization_id,'create',
    CASE WHEN p_collection='invoices' THEN 'sale' WHEN p_collection='purchases' THEN 'purchase' ELSE 'manual' END);
  SELECT * INTO r FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  n:=NULLIF(r.data->>'atefNumber','')::bigint;
  IF n IS NULL THEN n:=public.finora_next_atef(p_organization_id); END IF;
  t:=nullif(trim(coalesce(p_temporary_number,r.data->>'temporaryNumber',r.data->>'number','')),'');
  IF t IS NULL THEN t:='TMP-'||n::text; END IF;
  UPDATE public.records SET data=(r.data||jsonb_build_object('atefNumber',n,'temporaryNumber',t,'documentStatus','draft')-'number'-'postedAt'-'postedBy')
  WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id;
  INSERT INTO public.finora_document_lifecycle_audit(organization_id,atef_number,document_collection,document_id,event_type,temporary_number,actor_id)
  VALUES(p_organization_id,n,p_collection,p_id,'IDENTITY_ASSIGNED',t,auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN (SELECT data FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id);
END $$;

CREATE OR REPLACE FUNCTION public.finora_assign_permanent_document_number(
  p_organization_id uuid,p_collection text,p_id text,p_company_id text,p_fiscal_year_id text,p_document_type text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.records%rowtype; n bigint; status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FINORA_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM private.finora_phase1a_authorize(p_organization_id,'create',
    CASE WHEN p_collection='invoices' THEN 'sale' WHEN p_collection='purchases' THEN 'purchase' ELSE 'manual' END);
  SELECT * INTO r FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  status:=coalesce(r.data->>'status',r.data->>'documentStatus',r.data->>'accountingStatus','draft');
  IF status<>'posted' THEN RAISE EXCEPTION 'FINORA_DOCUMENT_NOT_POSTED' USING ERRCODE='23514'; END IF;
  IF coalesce(r.data->>'number','')<>'' THEN
    RETURN r.data;
  END IF;
  n:=public.finora_next_permanent_number(p_organization_id,p_company_id,p_fiscal_year_id,p_document_type);
  UPDATE public.records SET data=(r.data||jsonb_build_object('number',n::text,'documentStatus','posted','accountingStatus',CASE WHEN r.data ? 'accountingStatus' THEN 'posted' ELSE r.data->>'accountingStatus' END))
  WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id;
  INSERT INTO public.finora_document_lifecycle_audit(organization_id,atef_number,document_collection,document_id,event_type,temporary_number,permanent_number,actor_id,metadata)
  VALUES(p_organization_id,(r.data->>'atefNumber')::bigint,p_collection,p_id,'POSTED',r.data->>'temporaryNumber',n::text,auth.uid(),jsonb_build_object('document_type',p_document_type))
  ON CONFLICT DO NOTHING;
  RETURN (SELECT data FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_id);
END $$;

CREATE OR REPLACE FUNCTION public.finora_delete_draft_source(
  p_organization_id uuid,p_collection text,p_source_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE s public.records%rowtype; v public.records%rowtype; a bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FINORA_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM private.finora_phase1a_authorize(p_organization_id,'delete',
    CASE WHEN p_collection='invoices' THEN 'sale' WHEN p_collection='purchases' THEN 'purchase' ELSE 'manual' END);
  SELECT * INTO s FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_SOURCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF coalesce(s.data->>'documentStatus',s.data->>'accountingStatus',s.data->>'status','draft')<>'draft'
    THEN RAISE EXCEPTION 'FINORA_ONLY_DRAFT_CAN_BE_DELETED' USING ERRCODE='23514'; END IF;
  a:=NULLIF(s.data->>'atefNumber','')::bigint;
  IF coalesce(s.data->>'journalVoucherId','')<>'' THEN
    SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=s.data->>'journalVoucherId' FOR UPDATE;
    IF FOUND AND coalesce(v.data->>'status','draft')<>'draft' THEN RAISE EXCEPTION 'FINORA_LINKED_VOUCHER_NOT_DRAFT' USING ERRCODE='23514'; END IF;
    IF FOUND THEN
      INSERT INTO public.finora_document_lifecycle_audit(organization_id,atef_number,document_collection,document_id,event_type,temporary_number,related_collection,related_id,actor_id,original_status,metadata)
      VALUES(p_organization_id,(v.data->>'atefNumber')::bigint,'journalVouchers',v.id,'DELETED_WITH_SOURCE',v.data->>'temporaryNumber',p_collection,p_source_id,auth.uid(),'draft',jsonb_build_object('source_atef',a))
      ON CONFLICT DO NOTHING;
      DELETE FROM public.records WHERE organization_id=p_organization_id AND collection IN ('journalLineDimensions','journalLines') AND data->>'voucherId'=v.id;
      DELETE FROM public.records WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=v.id;
    END IF;
  END IF;
  INSERT INTO public.finora_document_lifecycle_audit(organization_id,atef_number,document_collection,document_id,event_type,temporary_number,actor_id,original_status,metadata)
  VALUES(p_organization_id,a,p_collection,p_source_id,'DELETED',s.data->>'temporaryNumber',auth.uid(),'draft',jsonb_build_object('cascade_voucher_id',s.data->>'journalVoucherId'))
  ON CONFLICT DO NOTHING;
  DELETE FROM public.records WHERE organization_id=p_organization_id AND collection=p_collection AND id=p_source_id;
  RETURN jsonb_build_object('deleted',true,'atefNumber',a,'sourceId',p_source_id);
END $$;

CREATE OR REPLACE FUNCTION public.finora_delete_draft_voucher(p_organization_id uuid,p_voucher_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.records%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FINORA_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM private.finora_phase1a_authorize(p_organization_id,'delete','manual');
  SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_VOUCHER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF coalesce(v.data->>'status','draft')<>'draft' THEN RAISE EXCEPTION 'FINORA_ONLY_DRAFT_CAN_BE_DELETED' USING ERRCODE='23514'; END IF;
  IF coalesce(v.data->>'sourceType','manual') IN ('sale','purchase') AND coalesce(v.data->>'sourceId','')<>'' THEN
    RAISE EXCEPTION 'FINORA_DELETE_SOURCE_REQUIRED: ابتدا سند تجاری منبع را حذف کنید' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.records WHERE organization_id=p_organization_id AND collection IN ('journalLineDimensions','journalLines') AND data->>'voucherId'=p_voucher_id;
  DELETE FROM public.records WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=p_voucher_id;
  INSERT INTO public.finora_document_lifecycle_audit(organization_id,atef_number,document_collection,document_id,event_type,temporary_number,actor_id,original_status)
  VALUES(p_organization_id,(v.data->>'atefNumber')::bigint,'journalVouchers',p_voucher_id,'DELETED_DRAFT_VOUCHER',v.data->>'temporaryNumber',auth.uid(),'draft')
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('deleted',true,'voucherId',p_voucher_id);
END $$;

GRANT EXECUTE ON FUNCTION public.finora_document_identity(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_assign_permanent_document_number(uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_delete_draft_source(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_delete_draft_voucher(uuid,text) TO authenticated;
