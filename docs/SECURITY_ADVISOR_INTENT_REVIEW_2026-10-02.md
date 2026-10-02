# Supabase Security Advisor Intent Review — 2026-10-02

Target: `hcsixhqbyuhpshfwqpjx` (Finora, ACTIVE_HEALTHY). Review mode: read-only production catalog/function inspection. No DDL or production data mutation was performed.

## Result

The advisor reports 20 `public` SECURITY DEFINER functions executable by `authenticated`. This is an intentional RPC boundary, not blanket table access. Live definitions were inspected individually. Every listed function has `SET search_path TO ''`; mutating functions authenticate the caller and enforce either global admin, organization owner/configure capability, module entitlement, target membership, or record-read scope before privileged writes. Read helpers return caller-scoped authorization/entitlement state.

### Reviewed public RPC groups

- Global license administration: `admin_cancel_license`, `admin_extend_license`, `admin_set_company_limit`, `admin_set_license`, `admin_set_license_modules`, `admin_set_user_limit`. Each gates mutation through `public.is_admin()`; parameter bounds and existence/current-count checks are present where applicable.
- Caller authorization helpers: `is_admin()` and `has_active_license()`. Both derive state from `auth.uid()` / caller organization membership and do not accept a target identity.
- Office automation: `office_act_on_referral`, `office_archive_search`, `office_classify_correspondence`, `office_link_correspondence`, `office_mark_correspondence_read`, `office_refer_correspondence_v2`, `office_referral_work_queue`. Live definitions bind organization, entitlement, active membership/capability and record visibility as appropriate; referral actions additionally bind the target user/member.
- Enterprise invitations/capacity: `organization_accept_invitation`, `organization_capacity_summary`, `organization_create_invitation`, `organization_expire_invitations`, `organization_revoke_invitation`. Acceptance is authenticated, token-hash bound, expiry checked, email-bound and seat/license gated; management calls require owner/configure authority.

The warning is therefore retained and documented rather than “fixed” by removing the privilege needed for the RPC contract or by converting functions to invoker semantics without equivalent access paths. Any future new SECURITY DEFINER RPC must repeat the same explicit intent review.

## Private C8 no-policy tables

Live catalog verification for `private.office_workflow_events`, `private.office_workflow_instances`, and `private.office_workflow_policy_versions` shows: RLS enabled, policy count 0, and no SELECT/INSERT/UPDATE/DELETE privilege for `authenticated`; `anon` also has no SELECT. This is deliberate deny-by-default private storage behind controlled RPCs. Adding permissive RLS policies merely to silence the advisor would weaken the boundary.

## Remaining advisor gap

Leaked-password protection is still disabled in Supabase Auth. It is an external Auth configuration gap and was not changed by SQL. Enable it only through a supported connected Auth control surface; do not simulate it with application-side password lists or paid external services.

## Acceptance

- Production target identity rechecked before review.
- No anon access was introduced.
- No authenticated table CRUD was introduced for the private C8 tables.
- No privileged RPC authorization check was weakened.
- No paid infrastructure or external service dependency was added.
