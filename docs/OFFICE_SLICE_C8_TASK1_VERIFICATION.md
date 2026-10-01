# Office C8 Task 1 — Workflow Policy Verification

Date: 2026-10-01
Production project: `hcsixhqbyuhpshfwqpjx`

## Status
COMPLETED for Task 1: versioned workflow policy publication/catalog.

## Delivered
- Private versioned policy table with RLS and no direct client DML.
- Immutable published policy history.
- Bounded graph validation: 2–20 stages, <=60 edges, one start, terminal reachability, unique IDs, no self/duplicate edges, no terminal outgoing edges, bounded labels/definition, `edit|refer|approve` allowlist.
- Server-side serialized version allocation.
- Public SECURITY INVOKER publish/catalog wrappers over checked private implementations.

## TDD / nonproduction evidence
- RED confirmed before implementation: production policy table and publish/catalog RPCs were absent.
- Free disposable PostgreSQL 17 CI harness added; no paid branch/service used.
- PR #11 Quality run `36900700757`: disposable migration apply PASS; behavioral SQL assertions PASS with rollback; static C8 contract PASS; full accounting/enterprise/C1–C7 gates PASS; Real-DOM PASS.
- PR #11 Security run `36900700778`: CodeQL PASS. Dependency Graph availability remains an external repository-setting boundary.

## Production
- Applied migration: `20261001173917 office_slice_c8_workflow_policy`.
- Repository archive: `supabase/migrations/20261001173917_office_slice_c8_workflow_policy.sql`.
- Post-apply checks: table/RPCs present; RLS enabled; authenticated direct SELECT/INSERT denied; policy row count zero; anon publish/catalog execute denied.
- Security advisor: existing 20 public SECURITY DEFINER warnings unchanged. Private C8 table reports informational `RLS enabled no policy`, intentional because direct client DML is revoked and access is through checked functions.

## Rollback
Operational rollback disables C8 UI/write entry points while preserving policy evidence. Do not DROP or delete published policy history.

## Next
C8 Task 2: attach/transition/read transactional slice with immutable revisioned events, request-id idempotency, expected-revision conflict handling, source-first lock order and two-session concurrency verification before production DDL.
