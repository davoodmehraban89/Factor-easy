-- Phase 1A: reconstruct one Production-only phone identity migration, WITHOUT
-- renaming/editing any prior migration, without repairing Production history.
-- This file applies only in disposable CLI tests until a separate cutover approval.
-- Supabase Production already has phone/email identity changes: each statement is
-- idempotent and intentionally does not overwrite the existing identity RPC.
-- Rollback: only in a disposable clone with no dependent user data; drop the
-- newly created function, index, phone column; reset email NOT NULL only if safe.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles(phone) WHERE phone IS NOT NULL;

DO $phase1a$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.update_my_identity_profile(text,text)')
  ) THEN
    EXECUTE $new_fn$
      CREATE FUNCTION public.update_my_identity_profile(
        new_username text, new_full_name text DEFAULT NULL::text
      ) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
      AS $body$
      declare v_uid uuid:=auth.uid();v_username text:=lower(trim(coalesce(new_username,'')));
      begin
        if v_uid is null then raise exception 'Authentication required';end if;
        if v_username !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Username must be 3-40 latin letters, digits, dot, underscore or dash';end if;
        if exists(select 1 from public.profiles where lower(username)=v_username and id<>v_uid) then raise exception 'Username already in use';end if;
        update public.profiles set username=v_username,full_name=coalesce(nullif(trim(new_full_name),''),full_name) where id=v_uid;
      end $body$;
    $new_fn$;
  END IF;
END
$phase1a$;

REVOKE ALL ON FUNCTION public.update_my_identity_profile(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_identity_profile(text,text) TO authenticated;
