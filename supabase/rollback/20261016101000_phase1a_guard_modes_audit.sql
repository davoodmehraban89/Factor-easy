-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

DROP TRIGGER IF EXISTS trg_finora_phase1a_audit_immutable ON private.finora_phase1a_journal_audit;

REVOKE ALL ON FUNCTION private.finora_phase1a_audit_immutable() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_mode(p_org uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_server_journal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 v_is_server boolean := current_user IN ('postgres','supabase_admin','service_role');
 v_new_status text;
BEGIN
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
 -- Even privileged administrative DML may not fabricate an invalid status.
 IF v_new_status IS NOT NULL AND v_new_status NOT IN ('draft','posted','reversed') THEN
   RAISE EXCEPTION 'FINORA_INVALID_JOURNAL_STATUS' USING ERRCODE='23514';
 END IF;
 RETURN new;
END
$function$
;

REVOKE ALL ON FUNCTION private.finora_phase1a_guard_server_journal_fields() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.finora_phase1a_assert_posted_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_org uuid;
 v_id text;
 v_status text;
 v_count integer;
 v_invalid integer;
 v_debit numeric;
 v_credit numeric;
BEGIN
 IF TG_OP='DELETE' THEN RETURN NULL; END IF;
 IF new.collection<>'journalVouchers' THEN RETURN NULL; END IF;
 v_org:=new.organization_id;v_id:=new.id;
 SELECT v.data->>'status' INTO v_status FROM public.records v
 WHERE v.organization_id=v_org AND v.collection='journalVouchers' AND v.id=v_id;
 IF NOT FOUND OR v_status NOT IN ('posted','reversed') THEN RETURN NULL; END IF;
 SELECT count(*)::integer,
  count(*) FILTER(WHERE jsonb_typeof(l.data->'debit') IS DISTINCT FROM 'number'
    OR jsonb_typeof(l.data->'credit') IS DISTINCT FROM 'number'
    OR coalesce(l.data->>'debit','') !~ '^(0|[1-9][0-9]{0,27})$'
    OR coalesce(l.data->>'credit','') !~ '^(0|[1-9][0-9]{0,27})$')::integer,
  coalesce(sum(CASE WHEN coalesce(l.data->>'debit','') ~ '^(0|[1-9][0-9]{0,27})$' THEN (l.data->>'debit')::numeric ELSE 0 END),0),
  coalesce(sum(CASE WHEN coalesce(l.data->>'credit','') ~ '^(0|[1-9][0-9]{0,27})$' THEN (l.data->>'credit')::numeric ELSE 0 END),0)
 INTO v_count,v_invalid,v_debit,v_credit
 FROM public.records l WHERE l.organization_id=v_org AND l.collection='journalLines' AND l.data->>'voucherId'=v_id;
 IF v_invalid<>0 THEN RAISE EXCEPTION 'FINORA_INVALID_RIAL_AMOUNT' USING ERRCODE='23514'; END IF;
 IF v_count<2 OR v_debit<>v_credit THEN
   RAISE EXCEPTION 'FINORA_UNBALANCED_POSTED_JOURNAL' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END
$function$
;

REVOKE ALL ON FUNCTION private.finora_phase1a_assert_posted_balance() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_journal_children()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 x record;
 v_voucher_id text;
 v_parent_status text;
 v_org uuid;
 v_line_id text;
 v_debit numeric;
 v_credit numeric;
BEGIN
 IF TG_OP='DELETE' THEN
    IF old.collection NOT IN ('journalLines','journalLineDimensions') THEN RETURN old; END IF;
 ELSE
    IF new.collection NOT IN ('journalLines','journalLineDimensions')
       AND (TG_OP='INSERT' OR old.collection NOT IN ('journalLines','journalLineDimensions')) THEN
      RETURN new;
    END IF;
 END IF;
 -- Check both old and new voucher, so a malicious UPDATE cannot move a
 -- line/dimension away from a posted document.
 FOR x IN
  SELECT old.organization_id AS org,old.collection AS coll,old.data AS doc WHERE TG_OP<>'INSERT'
  UNION ALL
  SELECT new.organization_id AS org,new.collection AS coll,new.data AS doc WHERE TG_OP<>'DELETE'
 LOOP
    IF x.coll NOT IN ('journalLines','journalLineDimensions') THEN CONTINUE; END IF;
    v_org:=x.org; v_voucher_id:=nullif(x.doc->>'voucherId','');
    IF v_voucher_id IS NULL THEN RAISE EXCEPTION 'FINORA_CHILD_PARENT_REQUIRED' USING ERRCODE='23514'; END IF;
    IF x.coll='journalLines' AND TG_OP<>'DELETE' AND x.doc=new.data THEN
       IF jsonb_typeof(x.doc->'debit') IS DISTINCT FROM 'number'
          OR jsonb_typeof(x.doc->'credit') IS DISTINCT FROM 'number'
          OR coalesce(x.doc->>'debit','') !~ '^(0|[1-9][0-9]{0,27})$'
          OR coalesce(x.doc->>'credit','') !~ '^(0|[1-9][0-9]{0,27})$' THEN
          RAISE EXCEPTION 'FINORA_INVALID_RIAL_AMOUNT' USING ERRCODE='23514';
       END IF;
       v_debit:=(x.doc->>'debit')::numeric;
       v_credit:=(x.doc->>'credit')::numeric;
       IF (v_debit=0 AND v_credit=0) OR (v_debit>0 AND v_credit>0) THEN
          RAISE EXCEPTION 'FINORA_INVALID_RIAL_LINE' USING ERRCODE='23514';
       END IF;
    END IF;
    -- Row lock serializes this child's insertion and concurrent posting.
    SELECT v.data->>'status' INTO v_parent_status
    FROM public.records v WHERE v.organization_id=v_org
      AND v.collection='journalVouchers' AND v.id=v_voucher_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_CHILD_PARENT_NOT_FOUND' USING ERRCODE='23503'; END IF;
    IF v_parent_status IN ('posted','reversed') THEN
        RAISE EXCEPTION 'FINORA_POSTED_JOURNAL_CHILD_IMMUTABLE' USING ERRCODE='P0001';
    END IF;
    IF x.coll='journalLineDimensions' THEN
       v_line_id:=nullif(x.doc->>'journalLineId','');
       IF v_line_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.records l WHERE l.organization_id=v_org
          AND l.collection='journalLines' AND l.id=v_line_id
          AND l.data->>'voucherId'=v_voucher_id
       ) THEN
          RAISE EXCEPTION 'FINORA_DIMENSION_LINE_PARENT_MISMATCH' USING ERRCODE='23503';
       END IF;
    END IF;
 END LOOP;
 RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
END
$function$
;

REVOKE ALL ON FUNCTION private.finora_phase1a_guard_journal_children() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_audit_event(p_org uuid, p_voucher text, p_actor uuid, p_action text, p_reason text, p_details jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_log_guard(p_org uuid, p_voucher text, p_message text, p_state text) FROM PUBLIC,anon,authenticated,service_role;
