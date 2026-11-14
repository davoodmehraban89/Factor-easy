# Global draft conversion implementation plan

**Goal:** Return effective existing financial documents to reviewable drafts across every authorized tenant, and make new events draft-first.

**Architecture:** read-only graph inventory → validated conversion plan → atomic server executor → compatible source/journal UI → verified production batch. Original postings remain traceable. Backup prerequisite explicitly waived by the owner.

**Stack:** existing JavaScript application, Node built-in test runner, PostgreSQL/Supabase JSONB records. No new dependency.

**Spec:** [Draft-first accounting](../specs/2026-11-13-draft-first-accounting.md).

**Global constraints:** preserve owner/org/company identity, dimensions, deleted-reference reservations, reversed history and original numbers; no production values or identifiers in Git; no hidden posting through report actions. A passing planner is not authorization or proof of an executable conversion.

**Review focus:** cancelled-chain resurrection, double-reversal effective balances, duplicate finalization, stale snapshots, unresolved legacy/source scope and source/draft linkage.

1. Implement `scripts/lib/draft-conversion-plan.mjs` and meaningful `scripts/draft-conversion-plan.test.mjs` cases. Fail on broken links, cycles, forks, cross-scope records, unequal reversals, invalid money and missing sources; retain zero-effect cancelled chains. Verify no input mutation. Use sanitized server-side inventory, never a customer dump in Git.
2. Add repeatable SELECT-only inventory in `scripts/sql/draft-conversion-inventory.sql`. Compare the live graph with the planner; record aggregate findings, not customer rows. Resolve business-source/journal company disagreement and legacy electronic metadata explicitly.
3. Implement server draft identity/counters and source-linked draft CRUD/finalization, plus explicit source UI/report scopes. Test negative permissions, two fiscal years/companies, parallel requests, replay, deleted references and attached-draft finalization. Existing staged WP1 code is a prerequisite candidate, not deployed capability.
4. Implement transactional batch with fingerprint/idempotency and a journal/source write fence. Use existing history-preserving semantics; prove no partial conversion, preserved net balance in draft-inclusive reporting, cancellation neutrality and rollback before activation.
5. Execute the owner-authorized batch only when source UI can finalize the resulting drafts and all graph/dependency checks pass. Re-read global counts and per-scope reconciliation. Mark exact conversion results, skipped histories, unresolved records, test evidence and next phase in PROJECT_STATE and EXECUTION_STATUS.

Current checkpoint: step1/2 in progress; no production financial mutation. External backup is not a blocker. Do not present steps3–5 as complete.
