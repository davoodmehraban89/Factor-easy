import fs from 'node:fs';

const need=(text,rx,label)=>{if(!rx.test(text))throw new Error('ELI-1 invariant missing: '+label)};
const migration=fs.readFileSync('supabase/migrations/20260930050000_enterprise_license_seats_delegated_admin.sql','utf8');
need(migration,/add column if not exists max_users/i,'max_users');
need(migration,/add column if not exists limits jsonb/i,'future-safe limits metadata');
need(migration,/organization_active_member_count/i,'active seat count helper');
need(migration,/organization_has_seat/i,'seat availability helper');
need(migration,/for update;[\s\S]*named-user seat limit exceeded/i,'atomic license-row seat locking');
need(migration,/admin_set_user_limit/i,'platform user-capacity RPC');
need(migration,/new_max_users<v_active/i,'cannot reduce user limit below usage');
need(migration,/module_key = any\(array\[[\s\S]*'core'/i,'core permission domain');
need(migration,/organization_id=v_org and r\.collection='companies'/i,'organization-scoped company capacity');
need(migration,/has_org_capability\(p_organization_id,'core','configure'\)/i,'delegated core configure');
need(migration,/organization_set_member_status/i,'suspend-reactivate RPC');
need(migration,/organization_members_audit/i,'membership audit');

const q=fs.readFileSync('.github/workflows/quality.yml','utf8');
need(q,/Enterprise license seats and delegated admin invariants[\s\S]*enterprise-license-check\.mjs/i,'quality workflow entry');

console.log('ELI-1 database contract invariants: PASS');
