-- Candidate only: not a deployed migration. Internal allocator for ADR 0216.
-- Invoke only from a previously authorized journal transaction.
CREATE TABLE private.finora_attachment_counters (
 organization_id uuid NOT NULL,
 company_id text NOT NULL CHECK (btrim(company_id)<>''),
 last_number bigint NOT NULL CHECK (last_number BETWEEN 1 AND 9007199254740991),
 PRIMARY KEY (organization_id,company_id)
);
CREATE TABLE private.finora_attachment_registry (
 organization_id uuid NOT NULL,
 company_id text NOT NULL CHECK (btrim(company_id)<>''),
 voucher_id text NOT NULL CHECK (btrim(voucher_id)<>''),
 attachment_number bigint NOT NULL CHECK (attachment_number BETWEEN 1 AND 9007199254740991),
 deleted_at timestamptz,
 deleted_by uuid,
 CHECK ((deleted_at IS NULL) = (deleted_by IS NULL)),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (organization_id,voucher_id),
 UNIQUE (organization_id,company_id,attachment_number)
);
ALTER TABLE private.finora_attachment_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.finora_attachment_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.finora_attachment_counters,private.finora_attachment_registry FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.finora_reserve_attachment(p_org uuid,p_company text,p_voucher text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE existing private.finora_attachment_registry%ROWTYPE; n bigint;
BEGIN
 IF p_org IS NULL OR coalesce(btrim(p_company),'')='' OR coalesce(btrim(p_voucher),'')='' THEN
  RAISE EXCEPTION 'FINORA_ATTACHMENT_IDENTITY_REQUIRED' USING ERRCODE='23514';
 END IF;
 -- Serialize retries of the same voucher even if they supply different companies.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text||':'||p_voucher,216));
 SELECT * INTO existing FROM private.finora_attachment_registry
 WHERE organization_id=p_org AND voucher_id=p_voucher;
 IF FOUND THEN
  IF existing.company_id IS DISTINCT FROM p_company THEN
   RAISE EXCEPTION 'FINORA_ATTACHMENT_COMPANY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF existing.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'FINORA_ATTACHMENT_DELETED' USING ERRCODE='23514';
  END IF;
  RETURN existing.attachment_number;
 END IF;
 INSERT INTO private.finora_attachment_counters AS c(organization_id,company_id,last_number)
 VALUES(p_org,p_company,1)
 ON CONFLICT (organization_id,company_id) DO UPDATE SET last_number=c.last_number+1
 RETURNING last_number INTO n;
 INSERT INTO private.finora_attachment_registry(organization_id,company_id,voucher_id,attachment_number)
 VALUES(p_org,p_company,p_voucher,n);
 RETURN n;
END $f$;
REVOKE ALL ON FUNCTION private.finora_reserve_attachment(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
-- Do not integrate until historical high-water marks and tombstones are reconciled.

-- Tombstone only inside the authorized draft deletion transaction.
CREATE FUNCTION private.finora_tombstone_attachment(p_org uuid,p_company text,p_voucher text,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 IF p_org IS NULL OR p_actor IS NULL OR coalesce(btrim(p_company),'')='' OR coalesce(btrim(p_voucher),'')='' THEN
  RAISE EXCEPTION 'FINORA_ATTACHMENT_IDENTITY_REQUIRED' USING ERRCODE='23514';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text||':'||p_voucher,216));
 UPDATE private.finora_attachment_registry SET deleted_at=clock_timestamp(),deleted_by=p_actor
 WHERE organization_id=p_org AND company_id=p_company AND voucher_id=p_voucher AND deleted_at IS NULL;
 IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM private.finora_attachment_registry
 WHERE organization_id=p_org AND company_id=p_company AND voucher_id=p_voucher AND deleted_at IS NOT NULL) THEN
  RAISE EXCEPTION 'FINORA_ATTACHMENT_NOT_FOUND' USING ERRCODE='23514';
 END IF;
END $f$;
REVOKE ALL ON FUNCTION private.finora_tombstone_attachment(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.finora_attachment_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.deleted_by IS NOT NULL
   AND (NEW.organization_id,NEW.company_id,NEW.voucher_id,NEW.attachment_number,NEW.issued_at)
   IS NOT DISTINCT FROM (OLD.organization_id,OLD.company_id,OLD.voucher_id,OLD.attachment_number,OLD.issued_at) THEN
   RETURN NEW;
  END IF;
 END IF;
 RAISE EXCEPTION 'FINORA_ATTACHMENT_IMMUTABLE' USING ERRCODE='23514';
END $f$;
CREATE TRIGGER finora_attachment_no_rewrite BEFORE UPDATE OR DELETE ON private.finora_attachment_registry
 FOR EACH ROW EXECUTE FUNCTION private.finora_attachment_immutable();
CREATE TRIGGER finora_attachment_no_truncate BEFORE TRUNCATE ON private.finora_attachment_registry
 FOR EACH STATEMENT EXECUTE FUNCTION private.finora_attachment_immutable();
REVOKE ALL ON FUNCTION private.finora_attachment_immutable() FROM PUBLIC,anon,authenticated,service_role;
