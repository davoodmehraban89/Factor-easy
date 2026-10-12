# Finora Phase 0 — Acceptance register and first verified checkpoint

**Date:** 2026-10-12 · **Accountable lead:** QA / Validation · **Authority:** Owner: «تایید فاز رو استارت بزن»
**Approval state:** **ACCEPTANCE STARTED / PHASE 0 OPEN / NOT OWNER-ACCEPTED**.
**Scope:** approved eight-phase roadmap, Phase 0 F0-01–F0-08. This document does **not** accept Phase 0 or authorize security/finance writes.

## 1. Live pinned baseline

- Canonical repository: `davoodmehraban89/Factor-easy`; protected pre-checkpoint `main` = `601a5b7b066ce4cf7e68fad2abe642c3e846cdd3`.
- Same-SHA GitHub Quality [38203575835](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38203575835), Security [38203575840](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38203575840), Release gate [38203689209](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38203689209), gated Pages [38203706432](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38203706432): all **SUCCESS**; cancelled/skipped duplicate runs excluded.
- Re-read real Quality static job `114662032710`: 55 JS/52 MJS syntax passed; financial/Golden invariants passed; **83/83 Playwright Chromium passed (55.7s)**, including F0-03 invoice mock-server persistence, F0-05 1,208-product and 1,206-contact synthetic fixture. Three disposable DB jobs succeeded. These are not customer production E2E evidence.
- Remote authorized device `DESKTOP-71SJ63M`: read-only PowerShell `Invoke-WebRequest` to `https://factoreasy.ir/?phase0_acceptance=20261012` returned **HTTP 200**. No session, login, tenant data, JS version identity, save, or printing was verified by this HTTP-only check. Separate read-only HTTP GETs returned **200** for `js/login-connectivity.js`, `js/ux-hardening-r2.js` and `js/print.js` on the same device. This checks asset reachability only; it does **not** verify cache-version identity, authenticated operations or actual print output.
- Live Supabase project `hcsixhqbyuhpshfwqpjx` **ACTIVE_HEALTHY**; **81** migrations; newest `20261011174445 posted_source_idempotency_index`. Read-only advisor counts: [21 authenticated SECURITY DEFINER function warnings](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [3 private-table RLS-no-policy informational findings](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [1 leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These are **review inputs**, not 25 proven vulnerabilities.
- Reconciliation risk: live migration `20261007165208 phone_identity_profile` is present on production but its archive file `supabase/migrations/20261007163500_phone_identity_profile.sql` is **absent from current main**, and exists in stale open PR #58. Treat as migration/source drift for supervised analysis in Phase 1; **do not rerun or cherry-pick** that migration automatically.

## 2. Acceptance gate matrix

Status definitions: **CONTROLLED QA PASS** = actual Chromium or isolated tests with synthetic/mock data; **VERIFIED READ-ONLY** = live read-only metadata/HTTP observation; **UNVERIFIED** = required authentication/real tenant/printer scope not tested. No check becomes **OWNER-ACCEPTED** without direct evidence and explicit owner decision.

| ID | Priority | Current evidence | Acceptance status | Required next proof / owner |
|---|---|---|---|---|
| **F0-01** · Login/affected ISP | Production HTTP 200, historical synthetic Auth probes | **UNVERIFIED real user** / P0 open | Existing authorized login and refresh from affected ISP; browser/time/error screenshot with secrets redacted. QA/Auth. |
| **F0-02** · Real product & person selection | PR #83 merged; keyboard/F2 and synthetic matching in Chromium | **CONTROLLED QA PASS; live tenant UNVERIFIED** / P0 open | Select existing `هارد` or `بلوک` and person in authorized tenant; correct unit/price/company boundary; no cross-tenant leak. UX/Data. |
| **F0-03** · Invoice lifecycle | `scripts/phase0-invoice-persistence.spec.js` passes **2/2** on mock RPC: save→reload→edit→print, retry without duplication; no ledger posting | **CONTROLLED QA PASS; real persistence UNVERIFIED** / P0 open | Only separately approved isolated account/test scope: actual server save/reload/edit/print and reconcile duplicate count; never post fake accounting in production. Commerce/QA. |
| **F0-04** · Print | Owner hardcopy/photo reproduced pale diagonal `پیش‌نویس — غیرقطعی` overlay on existing goods/services invoice; narrowly removed in PR #90; draft and pro-forma Chromium checks added, accounting state unchanged | **DEFECT REPRODUCED / FIX CONTROLLED QA PASS; OWNER REPRINT UNVERIFIED** / P0 open | After PR #90 gated deployment, owner checks a saved draft/ordinary sale invoice and purchase/pro-forma print: watermark absent, all rows/totals/dates visible; real printer/PDF and taxpayer-specific semantics are separate. Print QA. |
| **F0-05** · Large selectors | `scripts/phase0-selector-stress.spec.js`, **1,208 synthetic products + 1,206 persons** passed 2/2; keyboard/Persian/metadata covered | **CONTROLLED QA PASS for products/persons; real catalog and other high-volume selectors UNVERIFIED** / P1 open | Owner tenant/real workstation test plus assess account/project/contract selectors where applicable; measure interactive latency. UX/Perf. |
| **F0-06** · Modal, keyboard, RTL, themes | Controlled modal/dashboard regression and keyboard/F2, Quality suite green | **CONTROLLED QA PARTIAL; full visual/flow acceptance UNVERIFIED** / P1 open | Owner screenshots, all critical save/delete/import/export and RTL scrolling/dark-light. UI/QA. |
| **F0-07** · Access and release safety | GitHub Security PASS; Supabase 21+3+1 advisor results | **VERIFIED READ-ONLY metadata; dual-user tenant/RLS proof UNVERIFIED** / P0 open | Independent role/tenant negative E2E with authorized second identity, strict no-write safe plan; formal Phase 1 security audit. Security. |
| **F0-08** · Stale PR reconciliation | **9** live open PRs audited against current main; all `diverged` from main | **Read-only preliminary disposition RECORDED; no PR integrated** / P1 open | Review below and safely disposition PRs with owner/context; never merge stale sensitive code automatically. Coordination. |

### Exit decision

**PHASE 0 = OPEN.** P0 authenticated gates F0-01/02/03/04/07 have not met acceptance conditions. Passing CI, successful public HTTP and the existence of functional modules are insufficient for final Phase 0 signoff. Retain open items; no false `AUTHENTICATED_E2E_PASSED` or `OWNER_ACCEPTED` labels.

## 3. Read-only audit of nine historical open PRs (F0-08)

All nine PR heads **diverge** from current main (observed GitHub compare); therefore do **not** batch-merge or assume their old CI validates current code. Classification is a preliminary disposition, not permission to close or overwrite them.

| PR | Classification | Evidence / safe next action |
|---|---|---|
| [#6](https://github.com/davoodmehraban89/Factor-easy/pull/6) — accounting recovery | **Sensitive finance — manual audit** | 26 files, 872 additions, 851 main commits behind; journal, reversal and posted history. Reproduce missing behavior in isolated fixtures and compare to current invariant tests; no automatic merge. |
| [#28](https://github.com/davoodmehraban89/Factor-easy/pull/28) — Wave 4b QA docs | **Likely superseded documentation — confirm** | Old PR-only ledger/evidence, 173 behind; current PROJECT_STATE already holds newer acceptance records. Confirm any unique evidence before archive/close. |
| [#39](https://github.com/davoodmehraban89/Factor-easy/pull/39) — scrollbar-side change | **UI issue needs fresh browser evidence** | 164 behind; shares files with #40 and current `js/ui.js`. Compare physical scroll ownership against owner screenshot before selective fix. |
| [#40](https://github.com/davoodmehraban89/Factor-easy/pull/40) — structural scrollports | **UI issue needs fresh browser evidence** | 164 behind; overlapping alternative to #39; do not merge both. Verify actual RTL behavior first. |
| [#43](https://github.com/davoodmehraban89/Factor-easy/pull/43) — execution heartbeat | **Likely superseded documentation — confirm** | 162 behind; current AGENTS.md already defines checkpoint heartbeat. Check distinct wording before archive/close. |
| [#49](https://github.com/davoodmehraban89/Factor-easy/pull/49) — old state reconciliation | **Likely superseded documentation — confirm** | 157 behind; PROJECT_STATE now records October 12 protected-main checks. Historical note may be retained in Git history, not auto-merged. |
| [#57](https://github.com/davoodmehraban89/Factor-easy/pull/57) — dark contrast | **UX regression — fresh visual audit** | 150 behind; old hardening script overlaps recent changes. Check dark mode live screenshots and relevant selectors, port only proven missing fix if needed. |
| [#58](https://github.com/davoodmehraban89/Factor-easy/pull/58) — phone Auth / user mgmt | **High-risk identity + schema drift — manual security audit** | 142 behind, 14 files including Edge and SQL; prod has phone migration but main lacks archive. Never reapply migration, re-enable function or elevate auth on this evidence. |
| [#80](https://github.com/davoodmehraban89/Factor-easy/pull/80) — admin provisioning | **High-risk identity — explicit gate** | 64 behind, 8 files and server auth function. Contract demands JWT/role negative tests and authorized test identity; no account creation or publish without separate approval. |

**F0-08 preliminary finding:** 3 probable superseded docs (#28/#43/#49); 3 UI candidates needing fresh visual proof (#39/#40/#57); 3 sensitive finance/identity candidates (#6/#58/#80). Do not equate this classification with tested equivalence or final PR closure.

## 4. First owner-authenticated acceptance script (safe)

1. In the user's **existing** browser/ISP, sign in normally to `https://factoreasy.ir/`; record **PASS/FAIL**, local clock, browser and whether refresh works. **Do not send passwords, access tokens, cookies or recovery codes.**
2. On the existing company, open sale/purchase invoice and type a known existing product such as `هارد` or `بلوک`; verify suggestions, keyboard Enter, product price/unit, person selection. **Do not save/post** a production test invoice.
3. Choose an already saved document, inspect print preview/PDF, Persian digits, date and totals; share only a redacted observation or screenshot. **No financial modification.**
4. Creating/editing a disposable invoice against real Supabase requires an explicitly isolated authorized test company and signoff to write test records. Testing permission boundaries requires a separately authorized second account and safe test plan. Neither has been implicitly approved.

## 5. Next independent execution

- QA: capture owner-context PASS/FAIL for F0-01, then F0-02 and F0-04; investigate reproducible defect before patch.
- Coordination: resolve #39/#40/#57 UI visual differences under F0-06 without unreviewed old merges.
- Security: audit #58/#80 and source/migration drift read-only; no auth/schema/RLS/role changes until separately approved.
- Commerce: prepare F0-03 isolated real-server evidence only after scope and permission are confirmed.
- Phase acceptance requires full evidence and explicit owner approval. **No phase promotion now.**

**Rollback:** revert this documentation PR; no runtime, customer data, migrations, credentials, roles, accounting entries or production workflow modified.


## 2026-10-12 F0-04 owner's photographed watermark defect — controlled fix evidence

- Photograph provided by owner shows pale, diagonal `پیش‌نویس — غیرقطعی` rectangle over the title of an existing ordinary sales/goods-services invoice. This is **user-visible reproduction evidence**, not synthetic data. Source root: `renderAndPrintDirect` appended `draftMark` to `containerHtml` in `js/print.js` whenever `invoiceDocumentStatus(inv)==='draft'`.
- **Proposed PR #90:** shared ordinary invoice builder now prints complete `containerHtml` directly, with a new cache version in `index.html`. Independent purchase popup already had no draft watermark. The code does **not** alter `invoiceDocumentStatus`, journal posting/finalization, stored documents, tax-authority electronic print restrictions, money/date display, print pagination or signatures.
- **Verified on PR head before acceptance note:** GitHub Quality `38212287209` SUCCESS, including 83/83 real Chromium (54.8s), three disposable DB jobs and Golden accounting; Security `38212287223` SUCCESS (CodeQL and release safety). Browser regression tests cover a formal accounting draft and a pro-forma invoice: complete printed totals/number, watermark absent from both preview and isolated iframe, formal draft remains unposted. The financial static guard in `scripts/posting-idempotency-check.mjs` now rejects accidental reintroduction of the watermark while retaining posted/draft constraints.
- **Acceptance boundary:** This is a controlled correction, **not** proof that the owner's physical printer or saved live document is now correct. Do not close F0-04 or Phase 0 until gated Pages release and owner-authenticated preview/real print check. Other F0-01/02/03/06/07/08 checks are not automatically satisfied.
