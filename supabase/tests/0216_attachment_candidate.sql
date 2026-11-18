\set ON_ERROR_STOP on
BEGIN;
\ir ../candidates/0216_attachment_registry.sql
DO $test$
DECLARE a uuid:='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; b uuid:='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
 IF private.finora_reserve_attachment(a,'C1','V1')<>1 THEN RAISE EXCEPTION 'first allocation'; END IF;
 IF private.finora_reserve_attachment(a,'C1','V1')<>1 THEN RAISE EXCEPTION 'retry allocation'; END IF;
 IF private.finora_reserve_attachment(a,'C1','V2')<>2 THEN RAISE EXCEPTION 'second allocation'; END IF;
 IF private.finora_reserve_attachment(a,'C2','V3')<>1 THEN RAISE EXCEPTION 'company isolation'; END IF;
 IF private.finora_reserve_attachment(b,'C1','V1')<>1 THEN RAISE EXCEPTION 'organization isolation'; END IF;
 BEGIN
  PERFORM private.finora_reserve_attachment(a,'C2','V1');
  RAISE EXCEPTION 'company reassignment accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_COMPANY_IMMUTABLE' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM private.finora_reserve_attachment(a,'C1','ROLLBACK');
  RAISE EXCEPTION 'test rollback' USING ERRCODE='P0002';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM private.finora_attachment_registry WHERE organization_id=a AND voucher_id='ROLLBACK') THEN RAISE EXCEPTION 'rollback leaked registry'; END IF;
 IF private.finora_reserve_attachment(a,'C1','V4')<>3 THEN RAISE EXCEPTION 'rollback leaked counter'; END IF;
 IF pg_catalog.has_function_privilege('authenticated','private.finora_reserve_attachment(uuid,text,text)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon','private.finora_reserve_attachment(uuid,text,text)','EXECUTE')
 OR pg_catalog.has_table_privilege('authenticated','private.finora_attachment_registry','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated','private.finora_attachment_registry','DELETE') THEN
  RAISE EXCEPTION 'allocator exposed';
 END IF;
 BEGIN
  PERFORM private.finora_tombstone_attachment(a,'C1','UNKNOWN',a);
  RAISE EXCEPTION 'missing voucher tombstoned';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_NOT_FOUND' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM private.finora_tombstone_attachment(a,'C1','V1',NULL);
  RAISE EXCEPTION 'anonymous tombstone accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_IDENTITY_REQUIRED' THEN RAISE; END IF;
 END;
 PERFORM private.finora_tombstone_attachment(a,'C1','V2',a);
 PERFORM private.finora_tombstone_attachment(a,'C1','V2',b);
 IF NOT EXISTS(SELECT 1 FROM private.finora_attachment_registry WHERE organization_id=a AND voucher_id='V2' AND attachment_number=2 AND deleted_by=a AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'tombstone changed'; END IF;
 BEGIN
  PERFORM private.finora_reserve_attachment(a,'C1','V2');
  RAISE EXCEPTION 'resurrection accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_DELETED' THEN RAISE; END IF;
 END;
 IF private.finora_reserve_attachment(a,'C1','V5')<>4 THEN RAISE EXCEPTION 'number reused'; END IF;
 BEGIN
  DELETE FROM private.finora_attachment_registry WHERE organization_id=a AND voucher_id='V2';
  RAISE EXCEPTION 'physical deletion accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_IMMUTABLE' THEN RAISE; END IF;
 END;
 BEGIN
  TRUNCATE private.finora_attachment_registry;
  RAISE EXCEPTION 'registry truncation accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_IMMUTABLE' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE private.finora_attachment_registry SET attachment_number=99 WHERE organization_id=a AND voucher_id='V1';
  RAISE EXCEPTION 'rewrite accepted';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM <> 'FINORA_ATTACHMENT_IMMUTABLE' THEN RAISE; END IF;
 END;
END $test$;
ROLLBACK;
