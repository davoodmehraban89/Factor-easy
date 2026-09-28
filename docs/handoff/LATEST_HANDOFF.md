# Latest handoff — Phase 3 recovery

Date: 2026-09-28
Repository: `davoodmehraban89/Factor-easy`
Baseline: `8761d21189d9c4058c3019ea6e42d4103fc83556`
Working branch: `fix/phase3-behavioral-verification`
Status: client recovery patch tested; Phase 3 remains IN PROGRESS / NOT ACCEPTED.

## Start here

Read PROJECT_STATUS.md, docs/SIX_PHASE_ROADMAP.md and
docs/PHASE_3_REDESIGN_VERIFICATION.md. Do not repeat old four-phase numbering.
Resolve the actual remote branch/commit and PR before making status claims.
The user explicitly authorizes ordinary implementation, commits and pushes without
repeated confirmation. Actual permission boundaries, paid resources and unsafe
production mutations still require their appropriate protected workflow.

## Work performed

- Reproduced wrong reversal balances and retained both original/reversal movements.
- Rejected reversal-of-reversal, invalid calendar dates, non-finite/negative
  amounts, duplicate voucher numbers/active source posting and duplicate dimensions.
- Normalized ISO payment dates to the Jalali ledger calendar using Asia/Tehran.
- Added local rollback around source+voucher operations; failed corrections leave
  the old source intact; successful corrections increment source version and repost.
- Wired actual invoice/purchase/payment/expense create AND edit handlers to this path.
- Preserved legacy document creation before accounting is configured; partially
  configured accounting fails closed. Pro formas do not create revenue journals.
- Initialized profiles without requiring a prior journal-page visit; sales use
  configured profile accounts rather than guessing revenue from a cost-account title.
- Protected source history even after company selection changes or missing pointers.
- Blocked generic backup merge from altering/introducing journal history or
  overwriting protected source/master records; full-file preflight precedes mutation.
- Fixed journal pane routing, cleared successful manual submissions, reset stale
  company account selectors, and retained settled-invoice allocation during edits.
- Added explicit cheque tracker limitation; unsupported cheque accounting cannot
  masquerade as a cash receipt/payment.

## Verification

Behavioral suite: 55 tests passing in Node. Engine fixtures execute real app
modules; UI boundary fixtures execute actual handlers with controlled DOM and a
rejecting save boundary. This is not a real-browser or authenticated server test.

Commands required before publishing:

```sh
node scripts/syntax-check.mjs
node scripts/quality-check.mjs
node scripts/phase2-check.mjs
node scripts/phase3-check.mjs
node --test scripts/phase3-engine.test.mjs scripts/phase3-ui.test.mjs
git diff --check
```

Independent review found reversal-chain and date-validation issues; both were
reproduced and repaired. The reviewer could not deliver a final whole-diff verdict
because its execution hit a usage limit; do not claim independent final approval.

## Connection correction / next action

On 2026-09-28 at 16:48 UTC, direct access to the configured Supabase project
`hcsixhqbyuhpshfwqpjx` succeeded. Do not repeat the earlier unavailable claim:
`list_projects` and `list_organizations` omitted the target, but `get_project`,
table/migration inspection and metadata SQL succeeded. The discrepancy's cause
is not established. No alternate database, credential or connection was substituted.

The SQL session returned `supabase_read_only_user`, `transaction_read_only=on`,
and no CREATE privilege on public. No write access is claimed or bypassed.
See [the live metadata audit](../PHASE_3_CONNECTION_AUDIT.md) and the reusable
`scripts/sql/phase3-server-audit.sql`. The migration allowing Phase 3 collection
names was verified, but no accounting-specific trigger/constraint or public
posting/reversal RPC was found. Only owner/license RLS protects records.

Implement and test, in a verified writable development environment, a transactional
posting/reversal API with owner/company checks, fiscal locks, immutable history,
source uniqueness, revision/idempotency and numbering concurrency. Existing
generic 200-record upserts are NOT a database transaction; jeAtomic only protects
in-memory state. Authenticated device E2E and complete cheque lifecycle remain open.
Do not weaken a read-only role, use another project's database, or write production
financial records to test access. No credentials should be pasted into chat.

PR #6 contains the recovery patch. Quality checks and CodeQL passed on `8209c6f`;
Dependency review failed because Dependency graph is not enabled/supported for
the repository's current configuration. Repository administration is not exposed
by the connected GitHub tools; this setting was not changed and the check was not
disabled. See the audit for exact run and settings links.

Controlled ledger restore and historical cutover require staging, reconciliation,
backup and rollback. Never rewrite historical records as a convenience migration.

## Integration / rollback

Publish this patch as a branch/PR, not a production-complete release. No schema
migration is part of the patch. A revert can remove the code change, but would
restore the identified bugs; it must not delete or rewrite posted financial data.
No main merge or production deployment is claimed by this document.
