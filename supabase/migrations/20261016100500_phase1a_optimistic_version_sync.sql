-- FINORA Phase 1A -- optimistic revision and two-stage legacy sync migration.
-- TEST BRANCH ONLY; Production requires separate backup/restore + user permission.
-- RLS remains SECURITY INVOKER for all record writes. Authenticated raw
-- access remains a rollout risk until direct DML grants are retired (documented).
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.records'::regclass AND conname='finora_records_version_positive') THEN
   ALTER TABLE public.records ADD CONSTRAINT finora_records_version_positive CHECK (version>=1);
 END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_stamp_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
   IF new.version<>1 AND current_user IN ('authenticated','anon') THEN
     RAISE EXCEPTION 'FINORA_VERSION_FIELD_SERVER_ONLY' USING ERRCODE='P0001';
   END IF;
   new.version:=1;
 ELSE
   IF new.version IS DISTINCT FROM old.version AND current_user IN ('authenticated','anon') THEN
     RAISE EXCEPTION 'FINORA_VERSION_FIELD_SERVER_ONLY' USING ERRCODE='P0001';
   END IF;
   new.version:=old.version+1;
 END IF;
 RETURN new;
END
$fn$;

DROP TRIGGER IF EXISTS trg_finora_phase1a_stamp_version ON public.records;
CREATE TRIGGER trg_finora_phase1a_stamp_version
BEFORE INSERT OR UPDATE ON public.records FOR EACH ROW
EXECUTE FUNCTION private.finora_phase1a_stamp_version();

CREATE TABLE IF NOT EXISTS private.finora_phase1a_legacy_sync_calls (
 called_on date NOT NULL DEFAULT current_date,
 rpc_signature text NOT NULL CHECK (rpc_signature IN ('two_arg','three_arg')),
 calls bigint NOT NULL DEFAULT 0 CHECK (calls>=0),
 PRIMARY KEY(called_on,rpc_signature)
);
REVOKE ALL ON TABLE private.finora_phase1a_legacy_sync_calls FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.finora_phase1a_log_legacy_sync(p_signature text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_signature NOT IN ('two_arg','three_arg') THEN
    RAISE EXCEPTION 'invalid signature' USING ERRCODE='23514';
 END IF;
 INSERT INTO private.finora_phase1a_legacy_sync_calls(called_on,rpc_signature,calls)
 VALUES(current_date,p_signature,1)
 ON CONFLICT(called_on,rpc_signature) DO UPDATE
 SET calls=private.finora_phase1a_legacy_sync_calls.calls+1;
 RAISE LOG 'FINORA_LEGACY_SYNC_CALL signature=% day=%',p_signature,current_date;
END
$fn$;
REVOKE ALL ON FUNCTION private.finora_phase1a_log_legacy_sync(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.finora_phase1a_log_legacy_sync(text) TO authenticated;

-- Three-argument overload MUST NO LONGER HAVE DEFAULTS, otherwise calling
-- with two args is ambiguous in PostgreSQL and in PostgREST overload routing.
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

-- Versioned, transactional compare-and-swap endpoint. The client passes
-- expected_version=0 for creation and the last read version for writes.
-- Each failed CAS raises a stable error: no silent last-writer-wins.
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

REVOKE ALL ON FUNCTION private.finora_phase1a_stamp_version() FROM PUBLIC,anon,authenticated;
