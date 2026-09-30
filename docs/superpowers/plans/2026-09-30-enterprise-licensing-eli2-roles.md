# Enterprise Licensing ELI-2 — Reusable Roles Plan

Date: 2026-09-30

Goal: add reusable tenant-scoped role templates without replacing direct member grants.

Deliverables:
1. `organization_roles`, `organization_role_permissions`, `organization_member_roles`.
2. Owner/`core.configure` role administration only.
3. Effective authorization = direct member grants UNION active role grants, still intersected with commercial module entitlement, row scope and confidentiality.
4. Starter roles seeded per organization but never auto-assigned.
5. Role mutations audited.
6. Runtime/UI role assignment and editing in a later ELI-2 product commit after the server contract is verified.
7. Production migration + adversarial tests before completion.

Security:
- system roles cannot be deleted or have identity rewritten;
- role permission cannot activate an unlicensed module;
- module-only configurators do not become role administrators;
- assignments are tenant-bound and cannot target owners;
- stale permissions after commercial module reduction remain ineffective because entitlement is an independent gate.
