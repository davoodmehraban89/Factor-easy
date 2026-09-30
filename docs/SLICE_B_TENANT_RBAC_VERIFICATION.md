# Slice B — Organization Tenant + RBAC Verification

Date: 2026-09-30  
Status: implementation complete; PR CI is the release gate.

## Delivered boundary

Finora now separates four authorization dimensions that must all allow an operation:

1. **Organization membership** — `organizations`, `organization_units`, `organization_members`.
2. **Commercial entitlement** — the organization's existing license and module list.
3. **Member authorization** — `member_module_permissions` with `read/create/edit/delete/approve/register/refer/archive/configure`.
4. **Record boundary** — `own/unit/branch/company/organization` scope plus confidentiality clearance 0..3.

Existing accounts were migrated conservatively: every existing license received an isolated organization, the license owner became that organization's owner, and every existing `records` row was backfilled to the matching organization without rewriting posted accounting payloads. The record primary key is now `(organization_id, collection, id)` while `owner_id` remains the creator/own-scope identity.

## Production migrations

- `20260930031853_organization_membership_rbac_foundation`
- `20260930031942_office_shared_rbac_and_referrals`
- `20260930032615_slice_b_rbac_fk_indexes`
- `20260930032654_harden_legacy_office_storage_member_writes`

Exact applied SQL is archived under `supabase/migrations/`.

## Server enforcement

`records` SELECT/INSERT/UPDATE/DELETE policies now evaluate organization membership, organization license/module entitlement, capability, row scope and confidentiality. Writes additionally require an active organization license. Expired/cancelled organizations retain authorized historical reads.

`finora_sync_records` accepts an explicit `p_organization_id`; it refuses organizations outside the caller's memberships and refuses inactive-license writes. The client pulls only the selected organization.

Organization owners have implicit full member authorization inside commercially entitled modules. Non-owner members receive explicit module permissions. A module manager with `configure` can assign permissions for that module but cannot turn on a commercially unlicensed module.

## Office automation

- `office_register_correspondence` is organization-aware and requires active office entitlement + `register` capability.
- `office_refer_correspondence` requires active office entitlement + `refer` capability and only targets active members of the same organization.
- Referral records are immutable after insertion.
- Permission changes and referrals write `organization_audit`; audit rows are immutable.
- New attachment paths are `<organization>/<uploader>/<correspondence>/<file>` and Storage access resolves back to correspondence RLS/confidentiality.
- Legacy UID-prefixed attachment reads remain available for historical compatibility. Legacy-path writes are restricted to organization owners with active office entitlement; ordinary members must use the organization-aware path.

## Client behavior

`js/organization-rbac.js` loads organization memberships, selected organization, organization license and member permissions before app entry. Non-owner module navigation is derived from both commercial entitlement and member `read` capability. Organization-aware sync includes `p_organization_id`.

The organization access surface lets an organization owner add an already-registered Finora user by email and lets owners/module-configurers assign capability, scope and confidentiality. External invitation/email onboarding is intentionally not claimed yet.

`js/office-rbac.js` gates registry configuration, draft creation, registration and referral by capability and uses organization-aware attachment paths. Authorized office users see the shared records returned by server RLS; referral is exposed only to members with `refer`.

## Database verification executed in production transactions and rolled back

- own-scope member could not see another user's organization record;
- organization-scope `read` exposed normal correspondence but not correspondence above confidentiality clearance;
- increasing clearance exposed the confidential record;
- read-only member updated **0 rows**;
- cancelled-license organization owner could read historical correspondence and updated **0 rows**;
- referral RPC succeeded for a member with `read+refer` in organization scope;
- non-configure member could not read organization audit;
- referral mutation hit the immutable trigger (`42501`);
- organization-audit mutation hit the immutable trigger (`42501`).

All test data was inside transactions and rolled back.

## Advisor review

Security advisor after Slice B reports the same seven reviewed public `SECURITY DEFINER` warnings from the pre-existing admin/license helper set plus leaked-password protection disabled; Slice B introduced no new exposed `SECURITY DEFINER` RPC warning. Performance advisor initially identified four unindexed new foreign keys; migration `20260930032615` added the covering indexes. The remaining performance findings are only newly-unused-index informational notices immediately after creation.

## Still not claimed

- invitation of a person who does not yet have a Finora account;
- SSO/SCIM/enterprise identity provisioning;
- real Persian OCR accuracy;
- qualified digital signature / certificate validation;
- external ECE/email/webhook gateways;
- full visual workflow designer, delegation/substitution and SLA escalation;
- authenticated multi-device production browser E2E with two real user sessions (server RLS was tested by authenticated-role simulation).
