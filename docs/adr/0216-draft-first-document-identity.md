# ADR 0216 — Draft-first accounting identity
Status: accepted design; implementation and validation pending.
Issue: #216. PR #212 must not be merged unchanged.

## Numbering
- Attachment number: positive server-issued integer, unique by (organization_id, company_id, attachment_number), shared across all journal types and fiscal years. Immutable once issued. No recycling, including deleted vouchers.
- Provisional and final numbers: separate counters scoped by organization, company, fiscal year. Preserve provisional number in audit after finalization. Final number immutable.
- Commercial document numbering independent from accounting numbering. Internal record identifiers remain independent of display numbers; do not assume legacy IDs are UUIDs.
- Company identity cannot be changed after attachment allocation; moving a draft requires audited cancellation and new creation.
- Registry persists after deletion; no cascade from voucher deletion. Allocate with atomic counter update and unique constraints. Failed uncommitted allocation is not an issued number. Retry with stable idempotency key.

## Lifecycle
All journal producers create draft vouchers. Commercial sources and linked draft vouchers must have atomic creation/update/deletion semantics or explicit recoverable pending state with no false success. Posting is an explicit authorized command, validates source version, fiscal period, balanced lines, and permissions, assigns final number and synchronizes source accounting state in one transaction. Direct deletion of generated voucher is forbidden with source navigation. Deleting source draft tombstones dependent draft voucher and records full audit; any posted dependency blocks deletion. Manual draft deletion also tombstones. Posted documents are corrected by authorized reversal, never silently edited.

## Migration
Inventory existing documents across all tenants and companies, missing and duplicate numbers, existing fiscal locks and reports. Preserve established attachment numbers where valid. Produce deterministic backfill and dry-run reconciliation; never reuse known deleted identifiers. Existing posted documents are not silently downgraded. A separate approved migration plan must distinguish test/operational drafts from historical posted financial records and assess financial effects. No production changes in this branch.

## Acceptance
Concurrent creation; retry after response loss; deletion then allocation; company/year boundary; forbidden cross-tenant access; immutable number enforcement; source deletion atomicity; direct generated voucher deletion rejection; finalization permission; locked periods; historical reconciliation; rollback; full browser and real database CI.

## Next steps
A: inventory DB schema and write transactional registry design.
B: map every journal producer and reporting semantics for drafts versus posted.
C: establish executable acceptance tests and mock parity.
