# Finora Phase 0 F0-08 — Historical PR reconciliation and disposition (2026-10-12)

**Source of truth:** protected `main` SHA `4595dafcb98185984894faacb97244cec2aa55e4` at start, `AGENTS.md`, `PROJECT_STATE.md`, the nine OPEN GitHub PRs and read-only live Supabase migration/function metadata.  
**Owner's direction:** continue approved Phase 0.  
**Responsible:** coordination/QA. **No historical PR code is to be auto-merged.**

## Decision discipline

1. A superseded PR may be **closed without merging** only when its historical intent is already present in main or preserved in a verified newer report. Closure is reversible, preserving its commits/discussion; it does not delete history.
2. Old PRs touching financial postings, existing-user credentials, RLS/Auth, schema/migration drift or disputed scrollbar geometry must remain **open for independent specialist verification**.
3. A historic green CI run validates its own commit, not current `main`. Controlled browser/SQL/CI QA is not owner-authenticated acceptance.
4. No production SQL, data, login, API, permissions, real account creation or external messages are altered in this F0-08 reconciliation.

## Specific nine-PR disposition, anchored to current released implementation

| PR | Bucket | Verified reason | Action |
|---|---|---|---|
| [#6](https://github.com/davoodmehraban89/Factor-easy/pull/6) | **FINANCE REVIEW — KEEP OPEN** | 26 files including voucher journals, reversal, invoices/purchases, bank and recovery test contracts; legacy Phase 3 patch predates newer immutable-posted/idempotency work. No safe equivalence proof. | Audit each proposed financial invariant in disposable fixtures; **never merge** the stale branch as one unit. |
| [#28](https://github.com/davoodmehraban89/Factor-easy/pull/28) | **SUPERSEDED DOCUMENTATION — CLOSE AFTER PORT** | Its unique Wave4b historical CI/SHA details are now preserved in `docs/REQUEST_WORKFLOW_WAVE4B_VERIFICATION.md`. Its claim that live production Wave4b migration was not applied is **false as of current live state**. | Close without merge **only after** this reconciliation merges; retain PR history. |
| [#39](https://github.com/davoodmehraban89/Factor-easy/pull/39) | **OWNER-VISUAL UI AUDIT — KEEP OPEN** | Competing direction-only RTL scrollbar placement and physical screenshot/video expectations; overlaps #40 and newer scroll ownership test. | Obtain verified physical-RTL scroll ownership evidence; no blind merge. |
| [#40](https://github.com/davoodmehraban89/Factor-easy/pull/40) | **OWNER-VISUAL UI AUDIT — KEEP OPEN** | Alternative structural scrollport geometry to #39; current desktop shell has three scroll owners with direction mapping covered by Playwright, but not owner physical acceptance. | Compare actual owner device screenshot and synthetic bounding/wheel tests; choose one safe targeted solution if needed. |
| [#43](https://github.com/davoodmehraban89/Factor-easy/pull/43) | **SUPERSEDED OPERATIONS DOC — CLOSE** | Current root `AGENTS.md` already instructs liveness updates at verified checkpoints, continued execution without reply and explicitly disallows claiming unverified progress. | Close obsolete alternative wording without merging; current charter retained. |
| [#49](https://github.com/davoodmehraban89/Factor-easy/pull/49) | **SUPERSEDED HISTORICAL STATE — CLOSE** | A historical 2026-10-06 `PROJECT_STATE.md` snapshot that cites 79 migrations and stale head. Actual 2026-10-12 Supabase has **82**; current state includes newer tested deployments, admin-provision repair and explicit open acceptance. | Close without merging stale snapshot; retain chronology in PR history. |
| [#57](https://github.com/davoodmehraban89/Factor-easy/pull/57) | **SUPERSEDED UI FIX — CLOSE** | Dark-mode controls/cards/shell/input/placeholder/disabled fields/combobox shipped in newer PR [#92](https://github.com/davoodmehraban89/Factor-easy/pull/92). Mandatory `scripts/phase0-dark-theme-contrast.spec.js` uses true Chromium contrast threshold 4.5:1; browser transition fixture stabilized in #95. | Close outdated branch without overwriting newer theme asset; owner full visual F0-06 still open. |
| [#58](https://github.com/davoodmehraban89/Factor-easy/pull/58) | **IDENTITY / SOURCE-DRIFT AUDIT — KEEP OPEN** | Old multi-feature patch also contains phone migration `20261007163500_phone_identity_profile.sql` absent from current main despite live migration ledger `20261007165208 phone_identity_profile`. Its Edge/Admin/Dark changes overlap newer fixes. | Audit migration body and source archive/name parity, SMS/Auth policy separately; **do not reapply old SQL or deploy old Edge function**. |
| [#80](https://github.com/davoodmehraban89/Factor-easy/pull/80) | **SUPERSEDED ADMIN FEATURE — CLOSE** | Main has server-only `admin-user-management` with JWT+trusted `profiles.role=admin`, UI, contract + Playwright provisioning tests. Follow-up [#94](https://github.com/davoodmehraban89/Factor-easy/pull/94) fixed real `organization license not found` bug with verified Supabase migration `20261012075507`; #95 archived it. Reintroducing old branch risks resetting auth and the corrected UI. | Close obsolete unmerged branch **without touching the deployed Edge function or account records**; actual admin-owner creation remains acceptance OPEN. |

## Live Wave 4b correction: migration recorded ≠ destination consumers operational

- Supabase project `hcsixhqbyuhpshfwqpjx` has **82 recorded migrations**; `20261002072526 request_wave4b_scheduler_outbox_delivery` is present.
- Direct read-only `pg_proc` query confirms `private.request_run_sla_scheduler`, `private.request_claim_outbox`, `private.request_complete_outbox`, `private.request_fail_outbox` plus public counterparts. The source file `supabase/migrations/20261002073500_request_wave4b_scheduler_outbox_delivery.sql` explicitly leaves D4c external destination consumers disabled.
- The original PR #28's "production migration not applied" was true only for its historical checkpoint. Present-tense main documentation has now been corrected. **No new scheduler task was executed, no consumer destination was contacted, and no claim of real delivery is made.**

## Retained blockers and follow-up

- **#6:** financial invariants and irreversible posted ledger safety require controlled independent proof.
- **#39/#40:** owner-real scrollbar placement in RTL; do not modify stable shell geometry without symptom/measurement.
- **#58:** source-vs-live phone identity migration drift and admin/Auth security; read-only drift reconciliation precedes any privileged action.
- Other Phase-0 acceptance gates F0-01 real affected-ISP login, F0-02 actual tenant catalogs, F0-03 safe authorized invoice persistence, F0-04 real printed invoice, F0-05 real 1,200+ selector and F0-07 dual-user/RLS remain OPEN.

## Evidence, limits and rollback

- Root PR diffs inspected: #6, #28, #39, #40, #43, #49, #57, #58, #80. Current main assets and contract checks inspected; branch-only historical CI is not recast as current source success.
- F0-08 can be marked **HISTORIC PR DISPOSITION RECONCILED** after documentation and closings are verified; **not** equivalent to overall Phase-0 acceptance.
- Rollback documentation by revert. Reopen any PR closed in error; no data, migration or external action requires rollback.

## 2026-10-12 execution result — historical PRs closed without merging

After [#96](https://github.com/davoodmehraban89/Factor-easy/pull/96) merged into protected `main` `2a4d637d0145f333412fbce0e299ab6962f0b262` (PR head Quality `38223670528` SUCCESS, **86/86 Chromium**, 3 disposable DB + financial invariants PASS; Security `38223670565` SUCCESS), all five proven-superseded PRs were individually re-read, given an evidence/risk comment and then **CLOSED WITHOUT MERGE**:

- [#28](https://github.com/davoodmehraban89/Factor-easy/pull/28) — comment `6120641718`
- [#43](https://github.com/davoodmehraban89/Factor-easy/pull/43) — comment `6120644468`
- [#49](https://github.com/davoodmehraban89/Factor-easy/pull/49) — comment `6120646995`
- [#57](https://github.com/davoodmehraban89/Factor-easy/pull/57) — comment `6120649594`
- [#80](https://github.com/davoodmehraban89/Factor-easy/pull/80) — comment `6120652469`

**Live GitHub recheck confirms exactly four still-open historical PRs:** #6 (accounting), #39/#40 (RTL scrollbar alternatives), #58 (identity/phone migration/source drift). These remain in specialist review, **not approved to merge**. Any PR may be reopened with new evidence. No actual user/account, financial, RLS/schema, Edge, Supabase or runtime action occurred as part of closing historical PRs. Phase 0 still OPEN, and the named business-flow acceptance gates remain pending.

