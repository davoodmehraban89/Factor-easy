import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migrationsDir=path.join(root,'supabase','migrations');
const files=fs.readdirSync(migrationsDir).filter(x=>x.includes('organization_membership_rbac_foundation')&&x.endsWith('.sql'));
if(files.length!==1)throw new Error(`expected exactly one Slice B RBAC migration, found ${files.length}`);
const sql=fs.readFileSync(path.join(migrationsDir,files[0]),'utf8');
const must=[
  'create table public.organizations',
  'create table public.organization_units',
  'create table public.organization_members',
  'create table public.member_module_permissions',
  'create table public.organization_audit',
  'add column if not exists organization_id uuid',
  'private.current_organization_ids',
  'private.has_org_capability',
  'private.record_in_member_scope',
  'private.record_confidentiality_allowed',
  "capabilities <@ array['read','create','edit','delete','approve','register','refer','archive','configure']::text[]",
  "scope_type in ('own','unit','branch','company','organization')",
  'alter table public.organizations enable row level security',
  'alter table public.organization_members enable row level security',
  'alter table public.member_module_permissions enable row level security',
  'alter table public.organization_audit enable row level security',
  'grant select on public.organizations to authenticated',
  'grant select on public.organization_members to authenticated',
  'grant select on public.member_module_permissions to authenticated',
  'create or replace function public.finora_sync_records',
  'p_organization_id uuid',
  'create or replace function public.office_refer_correspondence',
  'create or replace function public.organization_set_member_permission',
  'raise exception \'forbidden\' using errcode = \'42501\'',
  'organization_audit_immutable',
  'revoke all on function private.',
  "set search_path = ''"
];
for(const token of must)if(!sql.includes(token))throw new Error(`missing Slice B invariant: ${token}`);
if(/drop\s+table\s+public\.records/i.test(sql))throw new Error('Slice B must not destructively replace records');
if(/user_metadata/i.test(sql))throw new Error('authorization must not trust user_metadata');
console.log(`Slice B RBAC migration invariants PASS (${files[0]})`);
