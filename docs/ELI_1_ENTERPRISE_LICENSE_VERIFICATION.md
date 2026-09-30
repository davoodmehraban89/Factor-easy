# ELI-1 Enterprise License Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`
Repository: `davoodmehraban89/Factor-easy`

## Delivered
- Named-user commercial seat capacity: `licenses.max_users`.
- Future-safe quota metadata: `licenses.limits jsonb`.
- Grandfathering: existing licenses never reduced below existing active membership.
- Atomic active-seat enforcement on membership activation/reactivation.
- Platform-admin `admin_set_user_limit` with lower-than-usage rejection.
- Company-capacity enforcement corrected to organization/legal-company usage.
- Explicit delegated `core/configure` domain.
- Delegated member/unit administration without commercial-license mutation authority.
- Member suspend/reactivate lifecycle with owner protection.
- Membership/permission audit extension.
- Platform-admin named-user capacity UI and organization seat counters.
- Chromium coverage for named-user capacity and delegated-admin semantics.

## Production migration
Applied version: `20260930045827`
Name: `enterprise_license_seats_delegated_admin`
Repository archive: `supabase/migrations/20260930045827_enterprise_license_seats_delegated_admin.sql`

Post-apply invariants:
- license count: 4
- licenses below active-member usage: 0
- licenses below legal-company usage: 0
- rollback test residue unit `ELI-TX`: 0

## Transactional adversarial verification
All test mutations used existing legitimate Finora principals inside a transaction and were rolled back.

PASS:
1. Platform admin can raise named-user capacity.
2. Lowering named-user capacity below active usage is rejected.
3. Adding active members consumes seats.
4. Suspending a non-owner immediately frees a seat.
5. Reactivating a suspended member at full capacity is rejected atomically.
6. Delegated `core/configure` can create an organization unit and manage non-owner membership.
7. Delegated organization admin cannot call platform commercial-capacity mutation.
8. Ordinary member cannot manage another member.
9. Module configurator cannot grant another module without that module's configure authority.
10. Company capacity uses `records(collection='companies')` for the organization and ignores organization units/regions.
11. Membership changes generate organization audit evidence.

## GitHub verification
Verified product head: `b410145a5e821b3f39453ba10008b80d52151c37`
- Quality: run `36671228468` — PASS.
- Security/CodeQL: run `36671228442` — PASS.
- Pages: run `36671227923` — PASS.
Quality included existing accounting/Phase 2–6/Golden gates, ELI-1 static invariant checks, and Real-DOM browser specs.

## Supabase advisors after ELI-1
Security advisor:
- 8 authenticated-callable SECURITY DEFINER warnings; the new eighth item is `admin_set_user_limit`. It is intentionally callable by authenticated clients but internally requires `public.is_admin()`; transactional non-admin negative verification passed.
- Leaked-password protection remains disabled.

Performance advisor:
- 4 informational unused-index notices. No ELI-1 index removal is justified without representative workload.

## NOT VERIFIED
- Authenticated production browser E2E using a persistent second non-owner member. Production still has no persistent active non-owner member; no user was fabricated or permanently cross-added for testing.
- ELI-2 reusable roles.
- ELI-3 invitations/external email delivery.
