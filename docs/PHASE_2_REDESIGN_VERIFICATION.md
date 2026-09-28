# Finora — Phase 2 Verification

Date: 2026-09-28
Status: COMPLETED

## Scope
Phase 2 establishes the accounting master-data foundation while preserving Finora 1.0 operational records.

Implemented:
- three fixed account levels: General Ledger (کل), Subsidiary (معین), Detail (تفصیلی)
- account code, parent, normal balance, posting-level and active state
- user-defined analytic/floating dimensions
- configurable hierarchy depth from 1 to 8 for manual dimensions
- strict terminal-depth/leaf-only posting semantics
- hierarchy depth lock after the first value exists
- depth may be changed only after all unreferenced values are removed
- deletion guards for child/referenced analytic values
- account-to-dimension rules: required, optional, unavailable
- entity-backed dimensions for contacts, projects and branches
- fiscal-year master with overlap validation and lock state
- branch master
- global project master with multi-counterparty links
- legacy contact-owned project migration preserving IDs
- company activity classification and optional accounting starter template
- starter templates for trading, service, manufacturing, contracting, retail, distribution, nonprofit and professional-services companies
- template choice supports recommended setup or empty chart
- cloud sync, backup and Supabase records collection support for Phase 2 masters

## Safety invariants
1. A dimension's configured hierarchy depth cannot be changed while it contains values.
2. A manual analytic value is postable only at the configured terminal depth and only when it has no active child.
3. A terminal node cannot receive children beyond configured depth.
4. Referenced dimension values, projects and branches cannot be destructively removed.
5. Account codes and dimension/value codes are unique within the active company scope.
6. Subsidiary accounts require a GL parent; detail accounts require a subsidiary parent.
7. Only detail accounts are posting-enabled in the Phase 2 three-level model.
8. Fiscal years cannot overlap.
9. Existing Finora operational documents are not rewritten by Phase 2.
10. Legacy project migration copies into the global project master while preserving historical IDs.

## Production database
Supabase project: hcsixhqbyuhpshfwqpjx

The records collection constraint already permits:
- fiscalYears
- accounts
- dimensionTypes
- dimensionValues
- accountDimensionRules
- branches
- projects
- projectLinks

RLS remains enabled on records. No destructive schema/data migration was required for existing financial records.

At final verification, production contained zero Phase 2 master records, so no pre-existing Phase 2 user data required conversion.

## Release gates
- JavaScript syntax gate: required
- repository application invariants: required
- GitHub Pages deployment: required
- CodeQL security workflow: required
- Supabase security/performance advisors reviewed

Known platform-level security notices remain the previously documented intentional SECURITY DEFINER RPC exposure to authenticated users with internal authorization checks, plus Supabase Auth leaked-password protection being disabled. Neither was introduced by Phase 2.

## Boundary
Phase 2 does not create journal vouchers or double-entry postings. Those belong to Phase 3. This prevents partially implemented ledger behavior from being presented as operational accounting.
