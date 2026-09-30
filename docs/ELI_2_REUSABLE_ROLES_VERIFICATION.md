# ELI-2 Reusable Organization Roles Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
Tenant-scoped reusable roles, role permissions, multiple role assignments per non-owner member, direct+role effective authorization union, starter roles, system-role protection, audit, runtime role loading, role administration UI, and direct per-user grants retained as advanced overrides.

## Production migrations
- `20260930050542 enterprise_reusable_roles`
- `20260930050904 eli2_role_tenant_hardening`

The hardening migration closes direct-table tenant and commercial-entitlement bypasses.

## Adversarial verification
All mutations used existing principals inside transactions and were rolled back.
- delegated `core/configure` created role/permission/assignment;
- role-only accounting read became effective without configure over-grant;
- ordinary member could not administer roles;
- cross-tenant assignment rejected;
- unlicensed role permission rejected;
- system role deletion rejected;
- role audit emitted;
- direct-table cross-tenant assignment rejected by tenant-integrity trigger;
- direct-table unlicensed permission rejected;
- persistent test-role residue = 0.

Persistent seeded state: 24 system roles across 4 organizations, 28 starter role-permission rows, 0 member-role assignments.

## GitHub evidence
Product head `c2ecd2a0451b8b7db6a246af0e5c49cf617ef8e5`
- Quality `36672058163`: PASS, including accounting/Golden, ELI-1/ELI-2 checks and Real-DOM role spec.
- Pages `36672058038`: PASS.
- Security `36672058144`: still running when this evidence snapshot was written; NOT VERIFIED until observed complete.

## NOT VERIFIED
Persistent second-user production browser E2E; ELI-3 invitation delivery.
