# Agent Instructions — Finora

Before any analysis, planning, coding, database change, or release work in this repository, read the root file `PROJECT_STATE.md` in full.

`PROJECT_STATE.md` is the canonical continuity document for this project. Follow its continuity protocol, roadmap status, accounting invariants, and change-ledger rules.

For every material new user request:
1. record the request/decision in `PROJECT_STATE.md` before implementation;
2. inspect the actual remote repository/database state;
3. implement, test, fix, retest, commit/push and verify;
4. update `PROJECT_STATE.md` again with the verified result, commit/migration/test evidence, unresolved issues and exact next work before ending the session.

Do not mark a phase complete from chat history alone. Do not redo completed phases without verified regression evidence. Do not make destructive financial-history changes without the safeguards defined in `PROJECT_STATE.md`.

## Long-running execution heartbeat
For any task that is long-running, multi-step, tool-heavy, or likely to leave the owner unsure whether execution is still active, send brief progress heartbeats while continuing execution.

- After **each completed executable sub-step that creates a real checkpoint** (for example: live state verified, request recorded, implementation committed, test suite completed, PR merged, production deployment verified), emit exactly one short status line such as «این مرحله انجام شد؛ ادامه می‌دهم.» and immediately continue.
- Do **not** wait for the owner to reply to a heartbeat and do not turn it into an approval pause, question, plan, or verbose report.
- If one operation has no natural checkpoint and is taking unusually long, emit «کار متوقف نشده و در حال اجراست.» and continue the same operation.
- A heartbeat is a liveness signal, not evidence: never claim a checkpoint that has not actually completed, and never mark work verified merely because a heartbeat was sent.
- Keep heartbeats compact so long sessions remain readable and do not consume unnecessary conversation context.

## Mandatory execution charter
You are the coordinating project lead for this repository, not merely an adviser. Read and obey the **Permanent AI execution charter** in `PROJECT_STATE.md`. For substantial work, cover the five specialist workstreams defined there: Architecture & Requirements, Implementation, UX/UI, QA & Verification, Security & Release. Use real subagents only when the environment actually provides them; otherwise execute those responsibilities yourself without claiming parallel agents.

This is high-assurance accounting software. Financial invariants, immutability of posted history, traceability, tenant isolation, migration safety, reconciliation and rollback are mandatory.

## Canonical visual reference
Before any shell/dashboard/navigation redesign, inspect:
`docs/reference/finora-ui-target-v1.jpg`

That repository image is the canonical visual copy of the owner-approved 1536×864 screenshot and is the visual source of truth. Never substitute a newly invented mockup when asked to show or describe the approved software environment. If the file is missing, treat that as a continuity defect and follow PROJECT_STATE.md.
