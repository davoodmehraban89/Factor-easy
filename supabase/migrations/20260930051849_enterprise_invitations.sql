-- ELI-3: secure invitation lifecycle with seat-safe atomic acceptance.
-- External email delivery is intentionally out of scope for this migration.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized)) and email_normalized like '%@%'),
  unit_id uuid references public.organization_units(id) on delete set null,
  position_title text,
  token_hash text not null unique check (char_length(token_hash)=64),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_invitation_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invitation_id uuid not null references public.organization_invitations(id) on delete cascade,
  role_id uuid not null references public.organization_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id,invitation_id,role_id)
);

create unique index organization_invitations_pending_email_uq
on public.organization_invitations(organization_id,email_normalized)
where status='pending';

create index organization_invitations_org_status_idx
on public.organization_invitations(organization_id,status,expires_at);

create index organization_invitation_roles_invite_idx
on public.organization_invitation_roles(invitation_id,role_id);

alter table public.organization_invitations enable row level security;
alter table public.organization_invitation_roles enable row level security;

grant select on public.organization_invitations to authenticated;
grant select on public.organization_invitation_roles to authenticated;

create policy organization_invitations_select on public.organization_invitations for select to authenticated
using (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
);

create policy organization_invitation_roles_select on public.organization_invitation_roles for select to authenticated
using (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
);

create or replace function private.invitation_token_hash(p_token text)
returns text
language sql immutable security definer set search_path=''
as $$
  select encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex')
$$;

revoke all on function private.invitation_token_hash(text) from public,anon,authenticated;

create or replace function private.enforce_invitation_role_tenant_integrity()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if not exists(
    select 1 from public.organization_invitations i
    where i.id=new.invitation_id and i.organization_id=new.organization_id
  ) then raise exception 'invitation/organization mismatch' using errcode='23514'; end if;
  if not exists(
    select 1 from public.organization_roles r
    where r.id=new.role_id and r.organization_id=new.organization_id and r.active
  ) then raise exception 'role/organization mismatch' using errcode='23514'; end if;
  return new;
end $$;

revoke all on function private.enforce_invitation_role_tenant_integrity() from public,anon,authenticated;

create trigger trg_invitation_role_tenant_integrity
before insert or update on public.organization_invitation_roles
for each row execute function private.enforce_invitation_role_tenant_integrity();

create or replace function public.organization_create_invitation(
  p_organization_id uuid,
  p_email text,
  p_unit_id uuid default null,
  p_position_title text default null,
  p_role_ids uuid[] default '{}'::uuid[],
  p_expires_hours integer default 168
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_token text;
  v_hash text;
  v_id uuid;
  v_role uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not (
    private.is_org_owner(p_organization_id)
    or private.has_org_capability(p_organization_id,'core','configure')
  ) then raise exception 'forbidden' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'core',true) then
    raise exception 'organization license inactive' using errcode='42501';
  end if;
  if v_email='' or v_email not like '%@%' then raise exception 'invalid email'; end if;
  if p_expires_hours is null or p_expires_hours<1 or p_expires_hours>720 then raise exception 'invalid expiry'; end if;
  if p_unit_id is not null and not exists(
    select 1 from public.organization_units u
    where u.id=p_unit_id and u.organization_id=p_organization_id and u.active
  ) then raise exception 'invalid organization unit'; end if;

  if exists(
    select 1 from public.organization_members m
    join public.profiles p on p.id=m.user_id
    where m.organization_id=p_organization_id and lower(p.email)=v_email and m.status='active'
  ) then raise exception 'user is already an active member'; end if;

  update public.organization_invitations
  set status='revoked',revoked_at=now(),updated_at=now()
  where organization_id=p_organization_id and email_normalized=v_email and status='pending';

  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=private.invitation_token_hash(v_token);

  insert into public.organization_invitations(
    organization_id,email_normalized,unit_id,position_title,token_hash,status,expires_at,invited_by
  )
  values(
    p_organization_id,v_email,p_unit_id,nullif(trim(p_position_title),''),
    v_hash,'pending',now()+make_interval(hours=>p_expires_hours),(select auth.uid())
  )
  returning id into v_id;

  foreach v_role in array coalesce(p_role_ids,'{}'::uuid[]) loop
    if not exists(
      select 1 from public.organization_roles r
      where r.id=v_role and r.organization_id=p_organization_id and r.active
    ) then raise exception 'invalid invitation role'; end if;
    insert into public.organization_invitation_roles(organization_id,invitation_id,role_id)
    values(p_organization_id,v_id,v_role);
  end loop;

  return jsonb_build_object('invitation_id',v_id,'token',v_token,'expires_at',now()+make_interval(hours=>p_expires_hours));
end $$;

revoke all on function public.organization_create_invitation(uuid,text,uuid,text,uuid[],integer) from public,anon;
grant execute on function public.organization_create_invitation(uuid,text,uuid,text,uuid[],integer) to authenticated;

create or replace function public.organization_accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_email text:=lower(coalesce((select auth.jwt()->>'email'),''));
  v_hash text;
  v_inv public.organization_invitations%rowtype;
  v_member uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if nullif(trim(p_token),'') is null then raise exception 'invalid invitation token'; end if;

  v_hash:=private.invitation_token_hash(trim(p_token));
  select * into v_inv
  from public.organization_invitations
  where token_hash=v_hash
  for update;

  if not found then raise exception 'invitation not found' using errcode='22023'; end if;

  if v_inv.status='accepted' and v_inv.accepted_by=v_uid then
    select id into v_member from public.organization_members
    where organization_id=v_inv.organization_id and user_id=v_uid;
    return v_member;
  end if;

  if v_inv.status<>'pending' then raise exception 'invitation is not pending' using errcode='22023'; end if;

  if v_inv.expires_at<=now() then
    update public.organization_invitations set status='expired',updated_at=now() where id=v_inv.id;
    raise exception 'invitation expired' using errcode='22023';
  end if;

  if v_email='' then
    select lower(coalesce(p.email,'')) into v_email from public.profiles p where p.id=v_uid;
  end if;
  if v_email<>v_inv.email_normalized then raise exception 'invitation email mismatch' using errcode='42501'; end if;

  if not private.organization_has_module_entitlement(v_inv.organization_id,'core',true) then
    raise exception 'organization license inactive' using errcode='42501';
  end if;

  insert into public.organization_members(organization_id,user_id,unit_id,position_title,status,is_owner)
  values(v_inv.organization_id,v_uid,v_inv.unit_id,v_inv.position_title,'active',false)
  on conflict(organization_id,user_id) do update
    set unit_id=excluded.unit_id,
        position_title=excluded.position_title,
        status='active',
        updated_at=now()
    where not public.organization_members.is_owner
  returning id into v_member;

  if v_member is null then raise exception 'owner membership cannot accept invitation'; end if;

  insert into public.organization_member_roles(organization_id,member_id,role_id,assigned_by,active)
  select v_inv.organization_id,v_member,ir.role_id,v_inv.invited_by,true
  from public.organization_invitation_roles ir
  join public.organization_roles r on r.id=ir.role_id and r.organization_id=ir.organization_id and r.active
  where ir.invitation_id=v_inv.id and ir.organization_id=v_inv.organization_id
  on conflict(organization_id,member_id,role_id) do update
    set active=true,assigned_by=excluded.assigned_by,updated_at=now();

  update public.organization_invitations
  set status='accepted',accepted_by=v_uid,accepted_at=now(),updated_at=now()
  where id=v_inv.id;

  return v_member;
end $$;

revoke all on function public.organization_accept_invitation(text) from public,anon;
grant execute on function public.organization_accept_invitation(text) to authenticated;

create or replace function public.organization_revoke_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not (
    private.is_org_owner(p_organization_id)
    or private.has_org_capability(p_organization_id,'core','configure')
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  update public.organization_invitations
  set status='revoked',revoked_at=now(),updated_at=now()
  where id=p_invitation_id and organization_id=p_organization_id and status='pending';

  if not found then raise exception 'pending invitation not found'; end if;
end $$;

revoke all on function public.organization_revoke_invitation(uuid,uuid) from public,anon;
grant execute on function public.organization_revoke_invitation(uuid,uuid) to authenticated;

create or replace function public.organization_expire_invitations(p_organization_id uuid)
returns integer
language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if not (
    private.is_org_owner(p_organization_id)
    or private.has_org_capability(p_organization_id,'core','configure')
  ) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.organization_invitations
  set status='expired',updated_at=now()
  where organization_id=p_organization_id and status='pending' and expires_at<=now();
  get diagnostics v_count=row_count;
  return v_count;
end $$;

revoke all on function public.organization_expire_invitations(uuid) from public,anon;
grant execute on function public.organization_expire_invitations(uuid) to authenticated;

create or replace function private.organization_invitation_audit_capture()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_id text;
begin
  v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  v_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  insert into public.organization_audit(
    organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  values(
    v_org,(select auth.uid()),lower(tg_table_name||'_'||tg_op),tg_table_name,v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old)-'token_hash' else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new)-'token_hash' else null end
  );
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

revoke all on function private.organization_invitation_audit_capture() from public,anon,authenticated;

create trigger organization_invitations_audit
after insert or update or delete on public.organization_invitations
for each row execute function private.organization_invitation_audit_capture();

create trigger organization_invitation_roles_audit
after insert or update or delete on public.organization_invitation_roles
for each row execute function private.organization_invitation_audit_capture();
