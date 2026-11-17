-- Restore the original strict posted-source immutability guard.
CREATE OR REPLACE FUNCTION private.finora_stage3_guard_posted_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $guard$
DECLARE
  v_kind text;
BEGIN
  IF TG_OP NOT IN ('UPDATE','DELETE') THEN
    RETURN NEW;
  END IF;
  IF OLD.collection NOT IN ('invoices','purchases') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF auth.uid() IS NULL
     OR private.finora_phase1a_mode(OLD.organization_id) <> 'enforce' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_kind := CASE OLD.collection WHEN 'invoices' THEN 'sale' ELSE 'purchase' END;
  IF EXISTS (
    SELECT 1 FROM public.records v
    WHERE v.organization_id = OLD.organization_id
      AND v.collection = 'journalVouchers'
      AND v.data->>'sourceType' = v_kind
      AND v.data->>'sourceId' = OLD.id
      AND v.data->>'status' IN ('posted','reversed')
  ) THEN
    RAISE EXCEPTION 'FINORA_POSTED_SOURCE_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$guard$;

REVOKE ALL ON FUNCTION private.finora_stage3_guard_posted_source()
FROM PUBLIC, anon, authenticated;


-- Restore the original production source immutability guard exactly.
create or replace function public.finora_guard_posted_source_records()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  vid text := coalesce(old.data->>'journalVoucherId','');
  voucher_status text := '';
  source_locked boolean := false;
begin
  if old.collection not in ('invoices','purchases','payments','expenses','cheques','contractStatements') then
    return case when tg_op='DELETE' then old else new end;
  end if;

  if vid <> '' then
    select coalesce(r.data->>'status','') into voucher_status
    from public.records r
    where r.owner_id=old.owner_id
      and r.collection='journalVouchers'
      and r.id=vid;
  end if;

  source_locked :=
    coalesce(old.data->>'accountingStatus','')='posted'
    or (old.collection='cheques' and coalesce(old.data->>'status','') in ('cleared','bounced','cancelled'))
    or (old.collection='contractStatements' and coalesce(old.data->>'status','') in ('posted','reversed'))
    or voucher_status in ('posted','reversed');

  if not source_locked then
    return case when tg_op='DELETE' then old else new end;
  end if;

  if tg_op='UPDATE' and new.data=old.data then return new; end if;
  raise exception 'source record linked to posted/reversed accounting history is immutable';
end $$;

drop trigger if exists trg_finora_guard_posted_source_records on public.records;
create trigger trg_finora_guard_posted_source_records
before update or delete on public.records
for each row execute function public.finora_guard_posted_source_records();
