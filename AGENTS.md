# Agent Instructions — Finora

Before any analysis, planning, coding, database change, or release work in this repository, read the root file `PROJECT_STATE.md` in full.

`PROJECT_STATE.md` is the canonical continuity document for this project. Follow its continuity protocol, roadmap status, accounting invariants, and change-ledger rules.

For every material new user request:
1. record the request/decision in `PROJECT_STATE.md` before implementation;
2. inspect the actual remote repository/database state;
3. implement, test, fix, retest, commit/push and verify;
4. update `PROJECT_STATE.md` again with the verified result, commit/migration/test evidence, unresolved issues and exact next work before ending the session.

Do not mark a phase complete from chat history alone. Do not redo completed phases without verified regression evidence. Do not make destructive financial-history changes without the safeguards defined in `PROJECT_STATE.md`.
