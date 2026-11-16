-- FINORA Stage 1 ONLY / disposable CI. Role-to-account bindings are data, not
-- editable posting templates. Never deploy to Production or change enforce there.
CREATE TABLE IF NOT EXISTS private.finora_phase1a_account_role_snapshots (
 organization_id uuid NOT NULL,
 company_id text NOT NULL,
 version bigint NOT NULL CHECK(version>0),
 assignments jsonb NOT NULL CHECK(jsonb_typeof(assignments)='object'),
 account_fields jsonb NOT NULL CHECK(jsonb_typeof(account_fields)='object'),
 legacy_profiles jsonb NOT NULL DEFAULT '[]'::jsonb,
 approved boolean NOT NULL DEFAULT false,
 approved_by uuid,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,company_id,version)
);
CREATE TABLE IF NOT EXISTS private.finora_phase1a_account_role_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id uuid NOT NULL,
 company_id text NOT NULL,
 version bigint NOT NULL,
 actor_id uuid,
 action text NOT NULL,
 before_data jsonb NOT NULL,
 after_data jsonb NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(organization_id,company_id,version,action)
);
REVOKE ALL ON private.finora_phase1a_account_role_snapshots FROM PUBLIC,anon,authenticated;
REVOKE ALL ON private.finora_phase1a_account_role_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.finora_phase1a_role_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$ BEGIN
 RAISE EXCEPTION 'FINORA_ROLE_ASSIGNMENT_APPEND_ONLY' USING ERRCODE='42501';
END $fn$;
CREATE TRIGGER trg_finora_phase1a_role_snapshots_immutable
 BEFORE UPDATE OR DELETE ON private.finora_phase1a_account_role_snapshots
 FOR EACH ROW EXECUTE FUNCTION private.finora_phase1a_role_immutable();
CREATE TRIGGER trg_finora_phase1a_role_audit_immutable
 BEFORE UPDATE OR DELETE ON private.finora_phase1a_account_role_audit
 FOR EACH ROW EXECUTE FUNCTION private.finora_phase1a_role_immutable();

-- All fields on which sale/purchase role binding or canonical posting depends.
-- Compare actual JSON, not merely a non-cryptographic checksum.
CREATE OR REPLACE FUNCTION private.finora_phase1a_account_fields(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=''
AS $fn$ SELECT jsonb_build_object(
 'companyId',p->'companyId','systemRole',p->'systemRole',
 'normalBalance',p->'normalBalance','accountType',p->'accountType',
 'postingAllowed',p->'postingAllowed','active',p->'active',
 'code',p->'code','level',p->'level','parentId',p->'parentId') $fn$;

-- Bootstrap existing profiles as unapproved version-1 data for each tenant
-- and company; do not infer missing mappings from titles or numeric codes.
-- Existing systemRole assignments are captured only when unambiguous.
WITH scopes AS (
 SELECT DISTINCT organization_id,data->>'companyId' company_id
 FROM public.records
 WHERE collection IN ('accounts','postingProfiles')
 AND coalesce(data->>'companyId','')<>''
)
INSERT INTO private.finora_phase1a_account_role_snapshots
 (organization_id,company_id,version,assignments,account_fields,legacy_profiles,approved,reason)
SELECT s.organization_id,s.company_id,1,
 coalesce((SELECT jsonb_object_agg(z.role,z.account_id) FROM (
  SELECT a.data->>'systemRole' role,min(a.id) account_id
  FROM public.records a WHERE a.organization_id=s.organization_id
   AND a.collection='accounts' AND a.data->>'companyId'=s.company_id
   AND a.data->>'systemRole' IN
   ('cash_default','receivable_control','revenue_default','vat_payable',
    'purchase_default','payable_control','vat_recoverable')
  GROUP BY a.data->>'systemRole' HAVING count(*)=1
 ) z),'{}'::jsonb),
 coalesce((SELECT jsonb_object_agg(z.role,
  private.finora_phase1a_account_fields(a.data))
  FROM (
   SELECT x.data->>'systemRole' role,min(x.id) account_id
   FROM public.records x WHERE x.organization_id=s.organization_id
    AND x.collection='accounts' AND x.data->>'companyId'=s.company_id
    AND x.data->>'systemRole' IN
     ('cash_default','receivable_control','revenue_default','vat_payable',
      'purchase_default','payable_control','vat_recoverable')
   GROUP BY x.data->>'systemRole' HAVING count(*)=1
  ) z JOIN public.records a ON a.organization_id=s.organization_id
   AND a.collection='accounts' AND a.id=z.account_id),'{}'::jsonb),
 coalesce((SELECT jsonb_agg(jsonb_build_object(
  'kind',p.data->>'kind','debitAccountId',p.data->>'debitAccountId',
  'creditAccountId',p.data->>'creditAccountId','active',p.data->'active') ORDER BY p.id)
  FROM public.records p WHERE p.organization_id=s.organization_id
  AND p.collection='postingProfiles' AND p.data->>'companyId'=s.company_id),'[]'::jsonb),
 false,'legacy_snapshot_requires_owner_review'
FROM scopes s
ON CONFLICT DO NOTHING;
INSERT INTO private.finora_phase1a_account_role_audit
 (organization_id,company_id,version,actor_id,action,before_data,after_data,reason)
SELECT organization_id,company_id,version,NULL,'bootstrap','{}'::jsonb,
 jsonb_build_object('assignments',assignments,'legacyProfiles',legacy_profiles,
  'approved',false),reason
FROM private.finora_phase1a_account_role_snapshots
WHERE version=1 AND NOT approved ON CONFLICT DO NOTHING;

-- Invoker trigger preserves the actual authenticated DML role. In audit mode
-- allow the legacy UI sync and record its attempted finance-config mutation.
-- In enforce mode reject direct sync/raw DML. RPC publication only writes
-- private immutable snapshots, so no bypass flag or forgeable custom GUC.
CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_account_mapping_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_row public.records%rowtype;v_collection text;v_org uuid;
 v_mode text;v_changed boolean:=false;v_id text;
BEGIN
 IF TG_OP='DELETE' THEN
  v_row:=old;
 ELSE
  v_row:=new;
 END IF;
 v_collection:=v_row.collection;v_org:=v_row.organization_id;v_id:=v_row.id;
 IF current_user NOT IN ('authenticated','anon') THEN
  RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
 END IF;
 IF TG_OP='UPDATE' AND old.collection<>new.collection
    AND (old.collection IN ('postingProfiles','accounts')
       OR new.collection IN ('postingProfiles','accounts')) THEN
  v_changed:=true;
 ELSIF v_collection='postingProfiles' THEN
  v_changed:=true;
 ELSIF v_collection='accounts' THEN
  IF TG_OP='DELETE' THEN
   v_changed:=true;
  ELSIF TG_OP='INSERT' THEN
   v_changed:=coalesce(new.data->>'systemRole','')<>'';
  ELSE
   v_changed:=private.finora_phase1a_account_fields(old.data)
       IS DISTINCT FROM private.finora_phase1a_account_fields(new.data);
  END IF;
 END IF;
 IF NOT v_changed THEN
  RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
 END IF;
 v_mode:=private.finora_phase1a_mode(v_org);
 IF v_mode='audit' THEN
  PERFORM private.finora_phase1a_log_guard(v_org,v_id,
    'FINORA_DIRECT_ACCOUNT_MAPPING_WRITE collection='||v_collection,'P0001');
 ELSIF v_mode='enforce' THEN
  RAISE EXCEPTION 'FINORA_ACCOUNT_MAPPING_SYNC_FORBIDDEN'
    USING ERRCODE='42501';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
END $fn$;
CREATE TRIGGER trg_finora_phase1a_account_mapping_sync
 BEFORE INSERT OR UPDATE OR DELETE ON public.records
 FOR EACH ROW EXECUTE FUNCTION private.finora_phase1a_guard_account_mapping_sync();

-- Valid role/account pair, including company and direction/type.
CREATE OR REPLACE FUNCTION private.finora_phase1a_check_role_account(
 p_org uuid,p_company text,p_role text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE r public.records%rowtype; v_type text;v_nature text;
BEGIN
 IF p_role NOT IN ('cash_default','receivable_control','revenue_default',
 'vat_payable','purchase_default','payable_control','vat_recoverable') THEN
  RAISE EXCEPTION 'FINORA_POSTING_ROLE_UNSUPPORTED' USING ERRCODE='23514';
 END IF;
 SELECT * INTO r FROM public.records
 WHERE organization_id=p_org AND collection='accounts' AND id=p_account
  AND data->>'companyId'=p_company FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'FINORA_POSTING_ACCOUNT_OUT_OF_SCOPE' USING ERRCODE='23503';
 END IF;
 v_type:=CASE
  WHEN p_role IN ('cash_default','receivable_control','vat_recoverable') THEN 'asset'
  WHEN p_role IN ('payable_control','vat_payable') THEN 'liability'
  WHEN p_role='revenue_default' THEN 'revenue'
  WHEN p_role='purchase_default' THEN 'expense' END;
 v_nature:=CASE WHEN p_role IN ('payable_control','vat_payable','revenue_default')
  THEN 'credit' ELSE 'debit' END;
 IF r.data->>'systemRole' IS DISTINCT FROM p_role
  OR r.data->>'accountType' IS DISTINCT FROM v_type
  OR r.data->>'normalBalance' IS DISTINCT FROM v_nature
  OR r.data->>'level' IS DISTINCT FROM 'detail'
  OR r.data->>'postingAllowed' IS DISTINCT FROM 'true'
  OR r.data->>'active' IS DISTINCT FROM 'true'
  OR coalesce(r.data->>'code','')=''
 THEN RAISE EXCEPTION 'FINORA_POSTING_ACCOUNT_ROLE_INVALID'
  USING ERRCODE='23514';END IF;
 RETURN private.finora_phase1a_account_fields(r.data);
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_phase1a_publish_role_assignments(
 p_organization_id uuid,p_company_id text,p_assignments jsonb,
 p_expected_version bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_previous private.finora_phase1a_account_role_snapshots%rowtype;
 v_version bigint;v_role text;v_account text;v_fields jsonb:='{}'::jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.organization_members
  WHERE organization_id=p_organization_id AND user_id=v_actor
   AND status='active' AND is_owner=true)
 THEN RAISE EXCEPTION 'FINORA_ROLE_ASSIGNMENT_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE organization_id=p_organization_id
  AND collection='companies' AND id=p_company_id) THEN
  RAISE EXCEPTION 'FINORA_POSTING_COMPANY_INVALID' USING ERRCODE='23503';END IF;
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'object'
  OR p_assignments='{}'::jsonb OR length(trim(coalesce(p_reason,'')))<5
 THEN RAISE EXCEPTION 'FINORA_POSTING_ASSIGNMENT_INVALID' USING ERRCODE='23514';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(p_organization_id::text||':'||p_company_id,20261017));
 SELECT * INTO v_previous FROM private.finora_phase1a_account_role_snapshots
 WHERE organization_id=p_organization_id AND company_id=p_company_id
 ORDER BY version DESC LIMIT 1;
 v_version:=coalesce(v_previous.version,0);
 IF v_version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'FINORA_POSTING_CONTRACT_CHANGED' USING ERRCODE='40001';END IF;
 FOR v_role,v_account IN SELECT key,value FROM jsonb_each_text(p_assignments) LOOP
  v_fields:=v_fields||jsonb_build_object(v_role,
   private.finora_phase1a_check_role_account(
    p_organization_id,p_company_id,v_role,v_account));
 END LOOP;
 INSERT INTO private.finora_phase1a_account_role_snapshots
  (organization_id,company_id,version,assignments,account_fields,
   legacy_profiles,approved,approved_by,reason)
 VALUES(p_organization_id,p_company_id,v_version+1,p_assignments,v_fields,
  coalesce(v_previous.legacy_profiles,'[]'::jsonb),true,v_actor,p_reason);
 INSERT INTO private.finora_phase1a_account_role_audit
  (organization_id,company_id,version,actor_id,action,before_data,after_data,reason)
 VALUES (p_organization_id,p_company_id,v_version+1,v_actor,'publish',
  jsonb_build_object('version',v_version,'assignments',
   coalesce(v_previous.assignments,'{}'::jsonb)),
  jsonb_build_object('version',v_version+1,'assignments',p_assignments),
  p_reason);
 RETURN jsonb_build_object('version',v_version+1,'approved',true,
  'assignments',p_assignments);
END $fn$;
REVOKE ALL ON FUNCTION public.finora_phase1a_publish_role_assignments(uuid,text,jsonb,bigint,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_phase1a_publish_role_assignments(uuid,text,jsonb,bigint,text)
 TO authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_role_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_guard_account_mapping_sync() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_account_fields(jsonb) FROM PUBLIC,anon;
-- Pure immutable JSON projector used by SECURITY INVOKER sync guard.
GRANT EXECUTE ON FUNCTION private.finora_phase1a_account_fields(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_check_role_account(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
