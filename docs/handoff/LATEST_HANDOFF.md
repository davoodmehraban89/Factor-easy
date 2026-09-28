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

## Real blocker / next action

Restore official access to the exact configured Supabase project
`hcsixhqbyuhpshfwqpjx`. The available connection listed other project IDs only;
no alternate project was queried or substituted. No credentials should be pasted
into chat. No production database write or permission change was attempted.

Then inspect target policies/triggers/functions and implement/test a transactional
posting/reversal API with owner/company checks, fiscal locks, immutable history,
source uniqueness, revision/idempotency and numbering concurrency. Existing
generic 200-record upserts are NOT a database transaction; jeAtomic only protects
in-memory state. Authenticated device E2E and complete cheque lifecycle remain open.

Controlled ledger restore and historical cutover require staging, reconciliation,
backup and rollback. Never rewrite historical records as a convenience migration.

## Integration / rollback

Publish this patch as a branch/PR, not a production-complete release. No schema
migration is part of the patch. A revert can remove the code change, but would
restore the identified bugs; it must not delete or rewrite posted financial data.
No main merge or production deployment is claimed by this document.
