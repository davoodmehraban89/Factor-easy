-- Roll back source-tenant audit attribution to the prior candidate behavior.
CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_server_journal_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_finora_mode text;
 v_finora_org uuid;
 v_finora_msg text;
 v_finora_state text;
 v_is_server boolean := current_user IN ('postgres','supabase_admin','service_role');
 v_new_status text;
BEGIN
 v_finora_org:=CASE WHEN TG_OP='DELETE' THEN old.organization_id ELSE new.organization_id END;
 v_finora_mode:=private.finora_phase1a_mode(v_finora_org);
 IF TG_OP='UPDATE' AND private.finora_phase1a_mode(old.organization_id)='enforce' THEN v_finora_mode:='enforce'; END IF;
 IF TG_OP='UPDATE' AND v_finora_mode='off' AND private.finora_phase1a_mode(old.organization_id)='audit' THEN v_finora_mode:='audit'; END IF;
 IF TG_OP='UPDATE' AND old.collection='journalVouchers' AND old.data->>'status' IN ('posted','reversed')
 AND (old.organization_id,old.owner_id,old.collection,old.id) IS DISTINCT FROM (new.organization_id,new.owner_id,new.collection,new.id)
 AND private.finora_phase1a_mode(old.organization_id)<>'off' THEN
  RAISE EXCEPTION 'FINORA_POSTED_JOURNAL_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF v_finora_mode='off' THEN RETURN new; END IF;
 IF TG_OP NOT IN ('INSERT','UPDATE') OR new.collection<>'journalVouchers' THEN RETURN new; END IF;
 v_new_status:=new.data->>'status';
 IF NOT v_is_server THEN
   IF TG_OP='INSERT' THEN
      IF new.data ?| ARRAY['status','number','postedAt','postedBy','reversedAt','reversalVoucherId'] THEN
        RAISE EXCEPTION 'FINORA_SERVER_ONLY_JOURNAL_FIELDS' USING ERRCODE='P0001';
      END IF;
   ELSIF (new.data->'status') IS DISTINCT FROM (old.data->'status')
      OR (new.data->'number') IS DISTINCT FROM (old.data->'number')
      OR (new.data->'postedAt') IS DISTINCT FROM (old.data->'postedAt')
      OR (new.data->'postedBy') IS DISTINCT FROM (old.data->'postedBy')
      OR (new.data->'reversedAt') IS DISTINCT FROM (old.data->'reversedAt')
      OR (new.data->'reversalVoucherId') IS DISTINCT FROM (old.data->'reversalVoucherId') THEN
      RAISE EXCEPTION 'FINORA_SERVER_ONLY_JOURNAL_FIELDS' USING ERRCODE='P0001';
   END IF;
 END IF;
 IF v_new_status IS NOT NULL AND v_new_status NOT IN ('draft','posted','reversed') THEN
   RAISE EXCEPTION 'FINORA_INVALID_JOURNAL_STATUS' USING ERRCODE='23514';
 END IF;
 RETURN new;
EXCEPTION WHEN OTHERS THEN
 IF v_finora_mode='audit' THEN
   GET STACKED DIAGNOSTICS v_finora_msg=MESSAGE_TEXT,v_finora_state=RETURNED_SQLSTATE;
   PERFORM private.finora_phase1a_log_guard(v_finora_org,
     CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END,v_finora_msg,v_finora_state);
   RETURN new;
 END IF;
 RAISE;
END
$fn$;
