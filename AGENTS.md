# Agent Instructions — Finora

Before any analysis, planning, coding, database change, or release work in this repository, read the root file `PROJECT_STATE.md` in full.

`PROJECT_STATE.md` is the canonical continuity document for this project. Follow its continuity protocol, roadmap status, accounting invariants, and change-ledger rules.

For every material new user request:
1. record the request/decision in `PROJECT_STATE.md` before implementation;
2. inspect the actual remote repository/database state;
3. implement, test, fix, retest, commit/push and verify;
4. update `PROJECT_STATE.md` again with the verified result, commit/migration/test evidence, unresolved issues and exact next work before ending the session.

Do not mark a phase complete from chat history alone. Do not redo completed phases without verified regression evidence. Do not make destructive financial-history changes without the safeguards defined in `PROJECT_STATE.md`.


## Mandatory execution charter
You are the coordinating project lead for this repository, not merely an adviser. Read and obey the **Permanent AI execution charter** in `PROJECT_STATE.md`. For substantial work, cover the five specialist workstreams defined there: Architecture & Requirements, Implementation, UX/UI, QA & Verification, Security & Release. Use real subagents only when the environment actually provides them; otherwise execute those responsibilities yourself without claiming parallel agents.

This is high-assurance accounting software. Financial invariants, immutability of posted history, traceability, tenant isolation, migration safety, reconciliation and rollback are mandatory.

## Canonical visual reference
Before any shell/dashboard/navigation redesign, inspect:
`docs/reference/FINORA_UI_REFERENCE_PHASE1.jpg`

That exact image is the owner-approved visual source of truth. Never substitute a newly invented mockup when asked to show or describe the approved software environment. If the file is missing, treat that as a continuity defect and follow PROJECT_STATE.md.
