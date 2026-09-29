# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy`  
> Canonical branch: `main`  
> Working product name: **Finora**  
> Current public release identity: **Finora 1.0**
>
> This file is the single continuity/state document for any AI assistant, coding agent, developer, or future chat working on this repository. It must remain in the repository and must be updated continuously.

## Non-negotiable continuity protocol

Before doing any project work:

1. Open this file from the current remote `main` branch.
2. Inspect the actual current repository head and relevant production state. Never assume this file is newer than GitHub/Supabase evidence.
3. Read the latest user request and record any material new requirement, scope change, architectural decision, or requested phase change in **Current change ledger** below **before implementation**.
4. Continue from the latest verified checkpoint. Do not redo completed work unless a regression or contradiction is proven.
5. For financial/accounting changes, preserve data and auditability. Never perform destructive historical migration without preview, reconciliation, backup/rollback and explicit authority where required.
6. Execute continuously: **inspect → implement → test → fix → retest → commit/push → verify → continue**.
7. After every durable checkpoint/commit and before ending a work session, update this file with:
   - what changed;
   - exact completion status;
   - important commit SHA(s);
   - tests/CI/deployment evidence;
   - database migration(s), if any;
   - unresolved risks/blockers;
   - exact next executable work.
8. A phase may be marked **COMPLETED** only after its acceptance criteria and available release gates are verified. Never infer completion from chat text alone.
9. If execution is interrupted, the next worker must be able to resume using only the repository plus this file.
10. If this file conflicts with verified remote code/database evidence, correct this file immediately and record the correction in the change ledger.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-29 | Owner supplied another GitHub Actions failure (`golden-accounting-core-check.mjs`: `revenue report mismatch`) and asked for exact current progress plus continuous diagnosis/fix until the hardening work reaches a verified conclusion. Treat repeated run failures as blockers, distinguish superseded-run failures from current-head failures, and do not stop after a single fix while executable work remains. | IN PROGRESS | The supplied failure at `19:25:15Z` maps to the custom-chart transition around `d6b293e4`, not the later documentation head. Root accounting/report defect identified: Phase 6 `rollup()` discarded the account-master `accountType`, so `financials()` could not actually use the explicit classification promised by the earlier custom-chart hardening and silently fell back to code/title heuristics. This checkpoint preserves `accountType/systemRole` in report rollups, makes cash-flow use the explicit cash system role, and strengthens the Golden Journey with neutral arbitrary account titles plus diagnostic expected/actual values. CI run `36620001387` on `768f97ab` proves JavaScript syntax, application invariants, Phase 2–6 behavior, Golden Accounting Journey and browser-runtime install all PASS. The only failure is the new print DOM assertion using Playwright `toContainText()` on a `<style>` element; GitHub log shows the style element actually contains `A4 landscape`, but Playwright intentionally exposes style text as empty to text locators. This is a test-harness assertion defect, not a print-product defect. The next checkpoint reads `innerHTML` directly and reruns real-DOM. |
| 2026-09-29 | Owner reported repeated GitHub Actions `run failed` notifications and supplied a Quality log failing on stale static needle `v.status==='posted'`. Diagnose the live CI failure first, repair the gate without weakening accounting safety, verify current CI, then continue the approved hardening backlog. Reduce avoidable CI churn by batching subsequent related durable changes where practical. | FIXED / CI VERIFICATION PENDING | Root cause confirmed: `journal-engine.js` was intentionally hardened from posted-only source locking to posted+reversed locking, while `quality-check.mjs` still searched for the obsolete literal `v.status==='posted'`. The gate is being corrected to require `jeSourceLocked` plus `['posted','reversed'].includes`, which is stronger and matches live semantics. Fix commit `78c6a071` replaced the obsolete posted-only literal with the stronger `jeSourceLocked` + posted/reversed invariant. Follow-up inspection exposed a hidden Phase 2 test-script syntax defect (duplicate `const companies`) that the old syntax gate could not detect because it only parsed `js/*.js`; the next batched checkpoint removes that duplicate, makes syntax CI check every `scripts/*.mjs`, and removes duplicate Phase 6 behavior execution from `quality-check.mjs` now that Phase 6 has its own named workflow step. Root cause fixed at `78c6a071`; follow-up CI repair `20294e31` removed the hidden duplicate Phase 2 declaration, checks syntax of all MJS gates and avoids duplicate Phase 6 execution. `18ea5c8b` added Quality/Security concurrency cancellation plus real-Chromium A4/A5 pagination/page-break checks, reducing superseded-run noise. Subsequent requirement hardening: legacy-company starter-chart fix `3b3ffba2`; custom-chart system posting roles + arbitrary-code Golden Journey `d6b293e4`; role-aware AR/AP/cash-flow/project-contract reporting and prepared role uniqueness `dbe9170c`; incremental self-healing posting profiles `73bd9f3f`. Push-run IDs remain unavailable through the current connector, so latest CI/real-DOM is still NOT VERIFIED; any new failure log must be diagnosed before acceptance. |
| 2026-09-29 | Reconcile the D.M/Finora source contract against the implemented product and execute the post-release high-assurance hardening backlog (60-item audit), beginning with accounting-core safety and closing verified requirement gaps such as company-type starter charts, floating analytic dimensions and account-chart import. Preserve the generic normalized dimension engine; expose the owner-agreed four floating analytic slots as a compatible product contract. No destructive historical cutover or schema/RLS/auth/role mutation without the required explicit approval. | IN PROGRESS | Baseline: main `9159108a`; Supabase ACTIVE_HEALTHY with 15 migrations and RLS on all public tables. D.M source confirms GL/معین/تفصیلی + four configurable floating slots while storage remains generic. Core checkpoint `a22422bd`: safe empty-chart Excel import/validation/template helpers; compatible slots Branch=1, Counterparty=2, Project=3, Contract=4; Contract entity-backed dimension; contracting Project+Contract rules; template v2 and posting-profile seeding hook. UI checkpoint `f65fb577`: accounting UI now exposes safe Chart-of-Accounts Excel import/template download, explicit four-slot compatibility guidance, and Contract as an entity-backed analytic source. Rendering checkpoint `fdf65e49`: configured slot numbers are now visible as تفصیلی شناور ۱..۴ while generic dimensions remain unlimited. Posting checkpoint `e6067b83`: generic posting context now carries `contractId` for entity-backed Contract dimensions. Phase 4 checkpoint `39470402`: contractor statement postings now pass the active contract identity into analytic assignment. Test checkpoint `87dcf6e9`: Phase 2 gate now behavior-tests valid Excel chart normalization and invalid-parent rejection, and statically gates four-slot/Contract UI + posting integration. A1 negative-test checkpoint `f7d9b033`: behavior gate now explicitly rejects unbalanced journals, missing required analytic dimensions and non-postable analytic values, in addition to existing duplicate-source, reversal and fiscal-lock scenarios. Contract traceability test checkpoint `2d433cf3`: Phase 4 behavior gate now requires both Project and Contract analytic identities on every contractor statement posting line. Account-classification checkpoint `d7b7274b`: chart masters now persist account type/classification for templates, manual creation and Excel imports, aligned with the source Account entity. UI checkpoint `4eb0a451`: chart editor now explicitly captures asset/liability/equity/revenue/expense/memorandum/control account type. Chart table checkpoint `8a7996a2`: account type is now a first-class visible chart column. Row-render checkpoint `9008ec4f`: account classifications are rendered in the chart with legacy-safe fallback. Account-type gate `e8926876`: Phase 2 acceptance now requires classification logic, UI field/table column and import normalization. Security read-only review: production RLS policies are owner-scoped for `records` and admin/self-scoped for profiles/licenses; all 5 warned SECURITY DEFINER functions pin `search_path=public`, and the 3 admin mutation RPCs internally call `is_admin()` before mutation. Therefore advisor warnings are not by themselves proof of privilege escalation; authenticated cross-user negative E2E remains NOT VERIFIED. No RLS/auth/role change was made. Security workflow review: `Dependency review` is intentionally guarded by `if: github.event_name == 'pull_request'`; its skipped status on the prior push run is expected, not a failed security gate. CodeQL remains the push security gate. Starter-chart checkpoint `1a92a060`: added recoverable VAT (`1108 مالیات و عوارض دریافتنی`) so purchase VAT can resolve to a dedicated debit account instead of being folded into gross purchase cost. VAT account gate `40042e80` now prevents regression of the recoverable-VAT starter account. Critical restore/immutability checkpoint `4e5ad967`: `absorbRecords` now stages the entire merge and swaps datastore only after all validation succeeds (atomic in-memory restore); conflicts now protect posted/reversed vouchers, their journal lines/dimensions, posted source records, posted/reversed contract statements, posted inventory/depreciation records and audit rows. This closes a real partial-restore/posted-history overwrite risk in client restore logic. Restore regression gate `8aec35b8`: Phase 5 behavior test now proves a conflicting posted journal restore is rejected, earlier mutable changes are rolled back atomically, and a safe mutable merge still succeeds. Master-data checkpoint `42178d64` + gate `4c216040`: accounts referenced by automatic posting profiles can no longer be deleted, closing a setup-integrity hole before first journal use. Critical source-posting fix `6bb2dabd`: expense/income entry previously only wrote an operational record and ignored the selected counterparty/project; it now persists company/date/contact/project context and atomically creates the corresponding journal voucher, rolling the source back if posting fails. Source-posting gate `a10bcf64`: Phase 3 behavior now requires successful balanced posting for both expense and other-income sources. Reversal/immutability checkpoint `5b10463e` + gate `d0c61db6`: source records remain immutable after their voucher is reversed and cannot be silently reposted under the same source identity/version; corrections must use a new corrective source. This closes the UI-level post-reversal rewrite hole. Server-side source immutability beyond journal/Phase5 triggers still requires a DB migration and therefore explicit schema-change approval. Real-DOM gate checkpoint `423e38a6`: Chromium smoke now enters the accounting foundation and asserts the Chart-of-Accounts Excel import surface, four-slot contract guidance, account-type control and Contract dimension source before continuing existing ERP/report smoke. Server-side source immutability migration is now APPLIED in production as `20260929193348 posted_source_immutability_guard`; trigger `trg_finora_guard_posted_source_records` is verified present. The repository archive is normalized to the exact production migration version in this checkpoint. Phase 3 static gate `d4ed8811` now requires expense/income posting semantics, reversed-source locking, and the prepared server immutability migration to remain present. Production RLS negative read test executed safely with transaction-local `authenticated` role/JWT simulation for both record owners: owner A saw 46/46 own and 0 of owner B; owner B saw 39/39 own and 0 of owner A. This verifies cross-user SELECT isolation on live `records`; write isolation remains structurally enforced by WITH CHECK but not mutation-tested. Production privilege negative test executed: under transaction-local authenticated context a normal user resolved `is_admin=false`, while the known admin resolved `is_admin=true`; a normal-user call to `admin_cancel_license` was rejected with PostgreSQL `42501 forbidden` before mutation. This materially validates the internal authorization guard behind the SECURITY DEFINER warning; the other admin RPCs use the same `is_admin()` precondition but were not mutation-called. Production license gate test: active monthly/lifetime contexts return active, current trial returns active, and the existing cancelled account returns `has_active_license=false`; expired-date behavior is present in the function predicate but no expired production fixture exists, so expired E2E remains NOT VERIFIED. Concurrency checkpoint `e80306d4`: sync now treats DB uniqueness/immutability conflicts as authoritative financial conflicts instead of retrying forever; it discards the conflicting local pending state by reloading the server snapshot and requires user review before retry. Live unique indexes for journal number and source/version were re-verified present. Conflict regression gate `a060e38b`: Phase 5 behavior now proves both DB unique-conflict (`23505`) and immutable-history conflict paths reload authoritative server state and stop unsafe retry loops. Custom-chart/master-data checkpoint `b2e0bbc1` + `734e074a` + gate `ff85a711`: the contractual floating slots 1–4 are now initialized even when the user rejects the starter chart and chooses manual/Excel chart setup; company deletion now refuses any company with dependent chart/fiscal/dimension/journal/ERP records rather than checking only a few operational modules. Company-type semantic checkpoint `ad2a75d9` + gate `0dddd62c`: once a starter chart has been applied, direct activity-type changes are blocked because they would leave the company classification inconsistent with its accounting chart; such a change now requires a controlled chart migration. Analytic invariant gate `91e62bb1`: Phase 2 behavior now proves parent/non-terminal analytic nodes are non-postable, terminal leaf nodes are postable, and hierarchy depth cannot change after values exist. Analytic-assignment checkpoint `aeed833b` + behavior gate `894ab15a`: journal lines now reject duplicate assignments of the same dimension type; tests explicitly cover required, forbidden, non-postable and duplicate analytic cases. Duplicate-source atomicity checkpoint `e8eeeaf8` + gate `261107d0`: duplicate source/version is now rejected before any draft voucher/line mutation; regression test proves failed duplicate posting leaves no orphan draft or journal lines. CI clarity correction at `bf3c5c99`: Phase 6 behavior was still executed indirectly because `quality-check.mjs` imports `phase6-behavior-check.mjs`; however it was missing as a named workflow step. The workflow now runs it explicitly as a separately visible Phase 6 gate as well. Custom-chart reporting checkpoint `d0d0116b` + Phase 6 gate `7aff1083`: P&L/financial-position classification now uses explicit account-master `accountType` first, with legacy title/code inference only as fallback. This prevents custom/Excel charts from being misclassified merely because titles differ from Finora defaults. Excel classification checkpoint `5553ecab` + gate `45dd08e9`: Persian/English account types in imported charts are normalized to canonical financial classifications, blank types infer safely from known code families, and unknown explicit types are rejected instead of silently corrupting report classification. Golden-journey checkpoint `2a4872ac` + CI gate `5d5c2eb7`: Quality now executes a deterministic accounting core journey covering credit sale+VAT → receipt/AR settlement → credit purchase+recoverable VAT → payment/AP settlement → expense+other income → reversal → trial-balance reconciliation → P&L verification. Purchase-VAT posting defect fixed at `81144314` + static gate `b48e7253`: Posting Engine now resolves the dedicated recoverable-VAT starter account by code `1108` before title fallback, preventing custom titles from folding recoverable VAT into purchase cost. Test-harness correction `1537b1d5`: the new sync behavior test now supplies the browser event stubs required when evaluating `sync.js` under Node VM; this removes a harness-only `window/document.addEventListener` failure before CI verification. Analytic applicability coverage `ef796b76`: behavior gate now covers optional omission and rejects undefined analytic types in addition to required/forbidden/non-postable/duplicate cases. Integration security checkpoint `99b0b549` + behavior gate `be4c445e`: integration metadata now accepts HTTPS only, rejects URL-embedded credentials and local/private-network endpoints, reducing secret leakage and future server-side SSRF exposure; no external webhook was sent. Production authorization evidence: JWT-simulated admin/active/trial/cancelled identities returned expected `is_admin`/`has_active_license` states; a non-admin call to `admin_extend_license` was denied with SQLSTATE 42501 before mutation; empty atomic sync succeeded for an active user and was denied for a cancelled user with `active license required`. No production data was changed by these checks. Production RLS write-negative evidence: an authenticated non-owner attempted a direct cross-user `records` INSERT inside an explicit rollback transaction and PostgreSQL rejected it with SQLSTATE 42501 (`new row violates row-level security policy`). Combined with the prior 46/46 vs 0 and 39/39 vs 0 SELECT isolation checks, live tenant isolation is now verified for read and cross-owner insert paths; no test row persisted. Master-data history checkpoint `2839b3d2` + `1a98374f` + gate `6b727b3a`: counterparties and products can no longer be deleted when referenced anywhere in financial/operational history, closing destructive orphaning paths across invoices, payments, cheques, projects/contracts, inventory and analytics. Untrusted-file resource hardening: chart/sales/purchase/product Excel imports are capped at 5 MiB and 10,000 rows; backup/restore JSON inputs are capped at 20 MiB (`648b8fb0`, `a5b6766c`, `e3b68693`, `7a6ba9e3`, `49fbe3ab`, `814ac639`) with regression gates `a6ca42d5` and `2f0a0d42`. This reduces malformed/oversized import DoS exposure. Quality-gate maintenance `60da9fd6`: stale company-deletion assertions were updated to the new dependency-wide guard, and the static security gate now requires escaping of `& < > \" '` in the canonical `esc()` helper. Cheque-history checkpoint `568acd76` + `c2c35752` + gate `d4426d68`: cheques may transition while registered, but once cleared/bounced/cancelled they can no longer be edited or deleted through the UI, preserving settled instrument history. Prepared server guard extended at `88d282b1` + gate `cdfb7188` so the pending migration will also make cleared/bounced/cancelled cheques immutable at the database boundary. It remains PREPARED/NOT APPLIED because applying any schema trigger still requires explicit schema-change approval. Phase 5 semantic checkpoint `8d314917` + gate `85623aef`: auto-created fixed-asset/depreciation accounts now carry financial account classification, negative salvage value is rejected, and base currency cannot be changed directly after exchange rates exist (controlled migration required). Project/contract reconciliation checkpoint `86c6b2e4` + gate `abf422f9`: contract profitability now counts expense/purchase sources only when their accounting voucher is actively posted (when journal integration is available), so reversed source costs no longer remain in project profit after ledger reversal. Inventory policy gate `bc5ec91d`: Phase 5 acceptance now explicitly requires the application-level insufficient-stock check for transfer/adjustment-out, alongside existing weighted-average and movement-domain tests. Depreciation reversal remains a verified design gap because the current production immutability trigger does not permit a posted→reversed depreciation transition; fixing it requires a schema-trigger change and is therefore pending explicit schema approval. Starter-chart semantic checkpoint `8972838d` + behavior `315be83f`/`845e7562` + static gate `4260d223`: automatic postings now prefer the activity-specific starter accounts (e.g. trading sale `4107`, trading purchase `5102`, service revenue `4106`, retail/distribution/etc. revenue codes) instead of always bypassing them through generic `4101/5101`. Concurrency audit found no current duplicate business keys in production for accounts/dimensions/branches/projects/cost centers/contracts. Accounting/master uniqueness migration is now APPLIED in production as `20260929193357 accounting_master_uniqueness` after a duplicate-key preflight returned zero conflicts. All eight intended indexes, including unique account `systemRole` per company, are verified present. The repository archive is normalized to the exact production migration version in this checkpoint. Documentation continuity checkpoint `e4f406ca` repaired the malformed change-ledger table; `07ff3b24` labels `docs/PHASE_4_VERIFICATION.md` as legacy four-phase evidence and points to the canonical current `PHASE_4_REDESIGN_VERIFICATION.md`; successor/required-evidence lists now include Phase 4–6 verification docs. CI regression follow-up: after fixing the stale Quality assertion, inspection found `scripts/phase2-check.mjs` had a duplicate top-level `const companies` declaration that would have become the next failure. The batched CI repair removes it, extends syntax validation to all MJS test scripts, and avoids double-running Phase 6 behavior inside the static Quality script. CI regression follow-up `20294e31` repaired the hidden Phase 2 test-script syntax issue and broadened syntax coverage to all MJS gates. The next batched QA checkpoint adds real Chromium verification for 25-line formal/non-formal invoice pagination (3 pages), A4/A5 landscape orientation and print page breaks, while workflow concurrency cancels superseded Quality/Security runs to reduce avoidable notification noise. Legacy-company onboarding audit found two requirement-level defects: starter-template application checked the currently active company's chart instead of the target company, and its `finally` block left the target company active instead of restoring the prior context. Also, existing empty-chart companies could not opt into a recommended chart from Edit. The next batched checkpoint fixes all three and adds a behavior test proving a service starter chart can be applied to a non-active empty company without changing the active-company context. Custom-chart audit found a deeper requirement gap: imported/manual charts could exist, but automatic posting still resolved cash/AR/AP/revenue/purchase/expense/VAT mainly by Finora codes/title heuristics. The next batched checkpoint introduces explicit unique default system-posting roles on posting accounts, seeds them on company-type templates, supports them in manual/Excel chart setup, resolves posting accounts by role before legacy code/title fallback, and changes the Golden Journey to arbitrary account codes so CI proves a genuinely custom chart can still auto-post sale/purchase/receipt/payment/expense/income/VAT and reconcile reports. Custom-chart reporting follow-up: AR/AP aging and cash-flow cash detection were still title-based. The next checkpoint resolves AR/AP/cash through the same explicit system roles first, extends Phase 6 behavior to custom-title AR/AP aging plus project/contract consolidation, and extends the already PREPARED/NOT-APPLIED master-uniqueness migration with unique account system roles per company. No schema change is applied. Manual-chart audit found another functional gap: `jeEnsureDefaultProfiles()` previously returned as soon as any posting profile existed, so opening Journal midway through manual chart setup could permanently leave later receipt/payment/expense/income mappings missing. The next checkpoint makes profile seeding incremental/non-destructive and invokes it before every automatic post; behavior tests prove missing kinds are filled without replacing an existing active profile. Current hardening CI/real-DOM remain NOT VERIFIED until the latest head run completes. |
| 2026-09-29 | Execute master roadmap Phase 5 end-to-end: inventory/warehouse and costing; item/service master refinement; fixed assets; multi-currency; cost centers/advanced analytics; Excel/import center; backup/restore; company settings/permissions redesign; integration/API architecture. Preserve Phase 1–4 accounting invariants and require real-DOM, accounting/domain behavior, security and deployment gates before completion. | COMPLETED | Owner granted standing authorization for in-scope repository/Supabase changes. Delivered refined goods/services master; explicit sales/purchase warehouse routing; warehouse master, immutable stock movements, transfers, stock counts and weighted-average costing; valued inventory-adjustment journals; fixed assets and balanced depreciation journals; currency/rate masters; cost-center analytic source; company operational settings and explicit owner-RLS permission boundary; validated full restore with posted-history conflict protection; v5 backup/import preview; integration metadata/outbox without browser secrets; Phase 5 audit/navigation/sync/backup. Production migration `20260929172129_phase5_complementary_erp_collections` applied and archived under the exact production version; collection constraint, posted-record immutability trigger and five uniqueness indexes verified; records RLS remains enabled/owner-scoped; performance advisor clean. Import/restore hardening then added controlled validated merge (`16796d3d`, `ae40f5dc`, `4ede2d15`, `ce4c7dcb`); its first gate exposed a quoting syntax regression, fixed at `6abf95ca`. Final code-head verification at `6abf95ca`: Quality `36606240438` PASS including syntax, Phase 2–5 invariants/behavior and real Chromium DOM; Security/CodeQL `36606240384` PASS; Pages `36606238776` PASS. Authenticated production-user E2E, live third-party webhook delivery and physical-printer validation remain NOT VERIFIED and are not Phase 5 acceptance gates. |
| 2026-09-29 | Adopt owner-specified high-assurance execution protocol: verify live GitHub/Supabase before work; latest chat is the only source of new instructions; record requests before implementation; vertical slices; PROJECT_STATE in every durable commit; archive every future Supabase migration SQL; require real-DOM smoke + accounting-invariant tests before COMPLETED; explicitly list NOT VERIFIED items. | COMPLETED | Live reconciliation found head `7d054dfa` (post-login/admin-shell fix) was not recorded here; its CI is green but real-DOM smoke was not run. Phase 4 CI workflow also did not actually execute `phase4-behavior-check.mjs` because the command was folded onto the Phase 3 command, and no `supabase/migrations/` SQL archive exists. Phase 4 completion is therefore reopened pending real-DOM + accounting-invariant verification. Verification slice prepared atomically: corrected CI command separation, strengthened Phase 4 posting/reversal accounting test, added Playwright real-DOM post-login/shell smoke, and backfilled exact historical SQL files from `supabase_migrations.schema_migrations`. No database/schema/RLS/auth/role mutation was performed. Verification slice commit `55b62db0`: all 14 existing Supabase migration statements were archived exactly from migration history under `supabase/migrations/`; no database mutation occurred. Quality run `36600894426` succeeded, including Phase 3 behavior, actual Phase 4 accounting invariants and Playwright real-DOM smoke; Security/CodeQL `36600894268` succeeded; Pages `36600893196` succeeded. Live head discrepancy `7d054dfa` is now accounted for. Authenticated production-user E2E and physical-printer validation remain NOT VERIFIED. Live reconciliation before Phase 5: current head `deedea67` is documentation-only (`PROJECT_STATE.md`); Quality `36601108479` and Security `36601108485` succeeded on its parent `312fe95a`. Pages run `36601106234` on that parent failed only after a manual partial rerun created two `github-pages` artifacts; last clean Pages deployment remains `36600893196` on `55b62db0`. Head Pages run `36601145056` was cancelled. This deployment discrepancy is recorded and must be cleared by the next normal code commit/deployment before Phase 5 completion. |
| 2026-09-29 | Execute master roadmap Phase 4 end-to-end: projects/contracts, amendments/lifecycle, employer/contractor/subcontractor links, deductions, guarantees, contractor statements/accounting, traceability, reporting, permissions/audit/sync/backup/migration/tests/reconciliation. | COMPLETED | Re-accepted under the stricter verification rule at `55b62db0`: Playwright real-DOM smoke PASS and Phase 4 accounting invariants PASS in Quality `36600894426`; Security `36600894268` PASS; Pages `36600893196` PASS. Prior implementation evidence: domain/UI `c2100228`; persistence/navigation/backup through `172aeb59`; referential guards `44154769`; behavioral CI gate `fe29b817`; deduction-specific accounting/template migration `dd3b78ed`; verification doc `e5b814a7`. Supabase migration `20260929091743 phase4_contracting_collections` applied; RLS owner isolation verified; production had zero pre-existing Phase 4 rows requiring backfill; performance advisor clean; known pre-existing security warnings unchanged. Acceptance checkpoint `95e6de99`: Quality 36549015911 success; Security/CodeQL 36549015935 success; Pages 36549015796 success. |
| 2026-09-29 | Consolidate top-level Sales, Purchases, and People navigation into a single `بازرگانی` module while preserving the underlying views and workflows. | COMPLETED | Top-level `sales`, `purchases`, `people` rail entries removed; `commerce`/بازرگانی added with فروش، خرید، اشخاص submenu and canonical view mappings. Quality run 36545021724 success; Pages run 36545024472 success; Security/CodeQL run 36545021744 success. |
| 2026-09-29 | Restore invoice print contract: formal sales invoice = A4 landscape, pre-invoice = A4 landscape, non-formal invoice = A5 landscape; preserve standard print margins and page fit. | COMPLETED | `js/print.js` fixed on main: formal/pre-invoice A4 landscape with 5mm print margin; non-formal A5 landscape with 5mm margin; page-fit widths set to printable landscape areas. Regression gates updated in `scripts/quality-check.mjs` and `scripts/phase3-check.mjs`. Implementation commits `a7e14ec1`, `baa46715`, gate correction `4550f239`; Quality run 36544154873 success; Pages run 36544154397 success. Final checkpoint head `75cf79e5` re-verified: Quality run 36544278076 success; Security/CodeQL run 36544278147 success; Pages deployment run 36544277692 success. |
| 2026-09-29 | Reopen and fully harden Phase 3 after independent accounting review; fix fiscal-date posting, non-accounting document posting, reversal reconciliation, atomic persistence, server-side ledger guards, concurrency uniqueness and behavioral verification. | COMPLETED | Supabase migration `20260929083130 phase3_hardening_atomic_sync_and_ledger_guards` applied. Final implementation/evidence head before state closure: `c02e714c`; Quality run 36543480690 success; Security run 36543480544 success; Pages run 36543480478 success; Supabase migration/functions/unique indexes verified; Performance advisor clean. |
| 2026-09-29 | Establish a permanent in-repository continuity file so any future AI/chat can resume without relying on conversation history. Every material request must be recorded here before implementation and every durable checkpoint must update this file. | COMPLETED | `PROJECT_STATE.md` created in commit `9436b9014f8ce59e1a8c8dc238d1050831785c8f`; root `AGENTS.md` discovery instructions added in `dcabf31e7f9454ff84441cadb1e9aef85fff964c`. |
| 2026-09-29 | Continue product under working name Finora; final commercial brand may change later. Do not block engineering on naming. | ACTIVE DECISION | Rebrand must be a controlled migration when a final name is chosen. |
| 2026-09-29 | Six-phase redesign/ERP roadmap supersedes older phase numbering. | COMPLETED ROADMAP | Phases 1–6 are verified complete; current work is post-release validation/hardening and source-contract reconciliation. |
| 2026-09-29 | Owner reaffirmed permanent autonomous-manager behavior, five high-assurance specialist workstreams, mandatory pre/post change capture, and the approved Finora dashboard image as the visual source of truth for every future AI/chat. | COMPLETED | Root `AGENTS.md` + `PROJECT_STATE.md` are mandatory; visual path `docs/reference/finora-ui-target-v1.jpg`; original owner-upload SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`; portable bootstrap stored in `AI_BOOTSTRAP.md`. |
| 2026-09-29 | Owner reaffirmed durable cross-chat project continuity, five specialist workstreams, mandatory change capture, and the approved Finora dashboard as the visual source of truth. | COMPLETED | State/governance `69d0640c` + `041e6da4`; portable bootstrap `5dfb95ea`; UI reference docs `13def61f`; legacy pointer `897b7ad5`; README discovery `14effed9`. Canonical visual: `docs/reference/finora-ui-target-v1.jpg`; original screenshot SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`. Quality and Pages succeeded on `14effed9`; Security/CodeQL was still running when this checkpoint was written and must be rechecked by the next worker if not yet complete. |
| 2026-09-29 | Make the repository itself the durable brain for every future chat/agent; add autonomous execution governance, five specialist workstreams, and a canonical UI visual so no successor drifts from the approved product direction. | COMPLETED | Governance is encoded in this file and `AGENTS.md`; canonical visual is `docs/reference/finora-ui-target-v1.jpg`. The owner re-supplied the same approved 16:9 target on 2026-09-29; successors must use the repository reference and must not invent a replacement. |


## Execution authority and engineering standard

The worker reading this file is the **implementation owner and coordinating project manager for the current task**. Within the user's already-approved project scope, make normal, reversible engineering decisions autonomously and keep moving. Do not repeatedly ask the user to choose ordinary implementation details that can be resolved from requirements, evidence, accounting correctness, maintainability, security and UX.

This authority is operational authority inside the project; it is **not permission to impersonate the user** in external/legal/public contexts. Destructive irreversible actions, paid actions, public publication, messages to third parties, sensitive access changes, or decisions outside the approved project scope still require the appropriate explicit authority.

This is financial/accounting software. Treat correctness as safety-critical:
- prefer rejecting an invalid financial state over silently accepting it;
- preserve auditability and historical identity;
- enforce critical invariants at the data/domain boundary, not only in UI;
- use atomic writes/transactions where supported;
- posted accounting history is immutable; corrections use reversal/amendment;
- fiscal locks, authorization/RLS, source-to-ledger traceability and reconciliation are mandatory;
- never fabricate test results, migrations, deployment status or connector access;
- never present mock/demo data or an incomplete form as a completed accounting capability.

Quality target: build as if the system will be relied on for high-consequence professional financial work. Use the strongest engineering/design reasoning available, while keeping architecture proportional, maintainable and testable.

## Coordinated specialist workstreams

For substantial work, coordinate these five specialist responsibilities. If the execution environment has real sub-agent support, delegate independent tasks with one clear owner each. If it does not, execute the same responsibilities as explicit internal workstreams and **do not claim independent agents were created**.

1. **Architecture & Accounting Rules** — owns domain model, accounting invariants, posting contracts, migrations, compatibility and acceptance criteria.
2. **Implementation & Integration** — owns production code, schema/data integration, source-document flows, synchronization and maintainable implementation.
3. **UX/UI & Product Design** — owns information architecture, workflows, RTL/responsive/accessibility, visual consistency and the canonical design direction below.
4. **QA & Reconciliation** — independently validates behavior, regression, accounting balance/reconciliation, edge cases, migration fixtures and reproducible failures.
5. **Security, Data Integrity & Release** — owns RLS/permissions, immutable history, backup/rollback, performance/security gates, deployment evidence and release readiness.

The coordinating manager resolves conflicts by: accounting/data correctness -> user requirement -> security/auditability -> maintainability -> UX -> implementation convenience. Every task has one primary owner even when other workstreams review it.

## Canonical UI / visual source of truth

**Approved visual reference (fixed canonical path):** `docs/reference/finora-ui-target-v1.jpg`

![Finora canonical UI](docs/reference/finora-ui-target-v1.jpg)

The repository JPG is the canonical durable visual copy of the owner-approved 1536×864 (16:9) screenshot supplied on 2026-09-29. The original uploaded JPEG is fingerprinted by SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`; do not substitute another design or generated dashboard. This image is the canonical visual target for the current Finora desktop shell. When the user asks “محیط نرم‌افزار الان چجوره؟”, “طرح مورد تأیید چی بود؟”, or asks to continue the redesign, open this repository image first. Do not substitute a remembered/generated/random dashboard.

The owner re-confirmed this exact 16:9 design direction on 2026-09-29. The repository image is the durable visual artifact; do not rely on chat memory. If the file is missing/corrupt, treat it as a project-continuity defect and restore the approved artifact before redesign work.

The image defines the direction, not fake functionality:
- RTL professional financial dashboard;
- narrow right module rail with compact icons;
- second contextual submenu panel;
- top bar for user, notifications, quick action, active company, fiscal year and global search;
- spacious central workspace with compact KPI cards, charts/status panels, quick access and recent accounting records;
- light, restrained enterprise visual language suitable for dense accounting workflows;
- desktop-first information density with responsive behavior required on smaller screens.

When implementing new modules, preserve this shell language and extend it consistently. Existing working features must be migrated into the unified architecture; do not create a separate “old” and “new” product. Do not expose future modules as operational until their actual lifecycle, persistence, accounting integration, permissions and tests exist.

## Mandatory request/change capture

A material user request is not allowed to live only in chat. **Before implementation**, update the Current change ledger in this file with the new requirement/decision and mark it `REQUESTED` or `IN PROGRESS`. If the request changes roadmap, accounting rules, UX target, scope or acceptance criteria, update the relevant canonical section here at the same time.

After a durable implementation checkpoint, update the same ledger row with `COMPLETED`, `BLOCKED` or `DEFERRED` plus exact commit/migration/test/deployment evidence. If work is interrupted, the repository must still describe both what was requested and what remains.

## User communication mode

When the user explicitly says to execute without interim text/progress messages, honor that mode: perform tool work silently and send only the final completion notice, unless a genuine blocker requires a user decision. Do not substitute status chatter for execution.

## Continuous execution rule

For an approved phase/task, do not stop at planning, one file, one subtask, one commit or a progress explanation. Continue while executable work remains:

**verify remote state -> record request -> select highest-priority unfinished dependency -> implement -> test -> diagnose -> fix -> retest -> commit/push -> verify CI/database/deployment as applicable -> update this file -> continue**

Stop only for a real blocker that cannot be resolved with available authorized tools, or an action requiring authority not already granted. Before stopping for a blocker, finish all independent executable work and record the blocker and exact next action here.


## Current verified project state

The detailed handoff below has been reconciled through the completed six-phase roadmap. The accepted Phase 6 implementation/evidence head is `6dcb65f1`; the pre-hardening live main baseline verified on 2026-09-29 is `9159108a`. Always re-check the live `main` head before modifying code.

# Finora / Factor-easy — Durable Handoff

Date: 2026-09-29
Repository: davoodmehraban89/Factor-easy
Canonical branch: main
Accepted Phase 6 implementation/evidence head: 6dcb65f1305939ba719da9b8c83ff3d43c0e292e
Working product name: Finora
Current public release identity: Finora 1.0

## Source-of-truth rule
A successor must verify GitHub and Supabase before changing anything. This file is a recovery map, not a substitute for remote evidence.

## Master six-phase roadmap
1. UX/product architecture redesign and scalable navigation shell.
2. Master Data + Accounting Core foundation: chart, fiscal years, branches, global projects, generic hierarchical analytic dimensions, templates.
3. Double-entry operational accounting: journal engine, automatic postings, ledgers/trial balance, source immutability.
4. Projects, contracts, deductions, guarantees and contractor accounting.
5. Complementary ERP + integrations: inventory, costing, fixed assets, multi-currency/cost centers, import/backup/permissions/settings redesign.
6. Reports, control, migration and final release: professional accounting statements/reports, reconciliation/cutover of Finora 1.0 history, QA/security/performance/audit/backup/rollback/release.

The older docs/ACCOUNTING_CORE_ROADMAP_V1.md contains historical labels “Phase 5..8”. Do not treat those numbers as the current master phase numbering. Preserve its accounting decisions, but follow the six-phase roadmap above.

## Verified completion state

### Phase 1 — COMPLETED
Verification: docs/PHASE_1_REDESIGN_VERIFICATION.md
Acceptance commit: c51e49a3f7863886e8a997858d6f2c44165eb5de

Delivered:
- compact RTL module rail
- contextual second-level panel
- collapsible desktop navigation with persisted preference
- command/menu search and Ctrl/Cmd+K
- topbar company/fiscal context and quick action
- canonical view-to-module mapping
- responsive/mobile compatibility
- print isolation
- existing operational capabilities retained

### Phase 2 — COMPLETED
Verification: docs/PHASE_2_REDESIGN_VERIFICATION.md
Acceptance commit: 39702975a08ded8997787858383e20dab7d9afa9
Acceptance CI: Quality success 36438531727; Security success 36438531722; Pages success 36438530674.

Delivered:
- three fixed account levels: GL/کل, Subsidiary/معین, Detail/تفصیلی
- generic user-defined analytic dimensions
- configurable hierarchy depth 1..8
- leaf/terminal-only posting semantics
- depth locked after values exist
- safe delete/reference guards
- account-dimension required/optional/unavailable rules
- entity-backed contacts/projects/branches
- fiscal years and locks
- branch master
- global projects and legacy contact-project migration
- company activity types and optional starter templates
- sync/backup/Supabase collection support

Critical dimension invariant:
A dimension’s hierarchy depth is explicitly configured. Once values exist, depth cannot be changed directly. Used financial identities are not destructively deleted; they are deactivated/versioned/migrated. Group nodes are non-postable when leaf-only is enabled. Storage is normalized and not limited to floating1..floating4.

### Phase 3 — COMPLETED (HARDENED & RE-VERIFIED)
Verification: docs/PHASE_3_REDESIGN_VERIFICATION.md
Final evidence commit: 8761d21189d9c4058c3019ea6e42d4103fc83556
Final head CI: Quality success 36443016075; Security success 36443016203; Pages success 36443015338.
Implementation head documented in Phase 3 verification: b0f3e2587c6cc04beaf579505cb975a939459d6e.

Delivered:
- journal vouchers/lines and normalized line dimensions
- draft -> posted -> reversed lifecycle
- balanced debit/credit validation
- posting-account and analytic-dimension validation
- fiscal-year resolution/lock
- sequential voucher numbering
- source event/version uniqueness
- immutable posted vouchers; reversal instead of destructive edit
- manual journal UI with dynamic dimensions
- journal register and trial balance
- automatic posting profiles for sale, purchase, receipt, payment, expense and other income
- cash/credit aware sales/purchases
- VAT split behavior
- source-to-voucher adapter
- sync/backup persistence
- source-document immutability when linked to posted vouchers
- protection of used accounting masters/rules from destructive mutation

Important correction:
Earlier chat messages said Phase 3 was incomplete while execution was still catching up. GitHub remote evidence later closed and verified Phase 3. Current verified truth is Phase 3 COMPLETED.

## Production Supabase
Project ref: hcsixhqbyuhpshfwqpjx
Public tables: profiles, licenses, records; RLS enabled.
At handoff: profiles 4 rows, licenses 4 rows, records 84 rows.

Relevant migrations:
- 20260928141512 allow_accounting_foundation_collections
- 20260928145306 allow_phase3_double_entry_collections

Phase 3 allowed collections:
- postingProfiles
- journalVouchers
- journalLines
- journalLineDimensions

At final Phase 3 verification there were no Phase 3 journal rows requiring conversion/backfill. Historical Finora 1.0 accounting cutover was intentionally deferred.

Security advisor at handoff:
- five WARN findings for authenticated-callable SECURITY DEFINER functions: admin_cancel_license, admin_extend_license, admin_set_license, has_active_license, is_admin. These are known and were previously reviewed as intentional with internal authorization/RLS dependencies; do not blindly revoke authenticated execute.
- leaked password protection disabled in Supabase Auth; still an external/manual hardening item.
Performance advisor: no findings.

## Existing operational capabilities that must not regress
Sales invoices, purchase invoices, contacts/counterparties, products/services, receipts/payments with partial settlement, cheques, expenses/income, companies, global projects, reporting, formal/nonformal printing, Excel import, backup/cloud sync, admin/license controls, dashboard/drilldowns.

## Phase 4 — COMPLETED (RE-VERIFIED)
Phase 4 implementation and acceptance were re-verified under the stricter owner rule: real Chromium DOM smoke and actual accounting-invariant tests passed in Quality run `36600894426` on `55b62db0`. Delivered implementation scope:
- first-class contracts
- contract amendments/status/lifecycle
- employer/contractor/subcontractor relationships
- contract/project links
- deduction masters and schedules: retention, insurance, withholding tax, advance recovery, penalties, configurable other deductions
- guarantees: type, issuer/beneficiary, bank/institution, number, amount, issue/expiry, collateral, extension/release history
- optional memorandum/off-balance posting profiles for guarantees
- project/contract profitability and deduction/guarantee reporting
- source-to-voucher traceability for all new operations
- permissions, audit, reversal, sync/backup, migration, tests

Phase 4 acceptance must require master data + transaction lifecycle + posting + reversal + permissions + audit + reports + migration + tests + reconciliation. Forms alone do not complete a module.

## Phase 5 — COMPLETED
Complementary ERP/integration:
- inventory/warehouse and costing
- standard item/service master refinement
- fixed assets
- multi-currency
- cost centers/advanced analytics
- Excel/import center
- backup/restore
- company settings/permissions redesign
- integration/API architecture

## Phase 6 — COMPLETED
- journal/GL/subsidiary/detail/analytic ledgers
- trial balance variants
- P&L, financial position, cash flow
- AR/AP aging
- project/contract reports
- historical Finora 1.0 reconciliation and controlled cutover
- QA/security/performance
- audit/backup/rollback
- production release

## Accounting architecture decisions that are not to be casually reversed
- posted journal lines become accounting truth; operational documents remain source documents
- posted vouchers are immutable; corrections use reversal/amendment
- counterparties/projects/branches/contracts are global masters, not cloned into account trees
- do not create one ledger account per customer/supplier
- analytic dimensions are generic normalized assignments, not fixed four columns
- account determines which dimensions are required/optional/unavailable
- group/non-leaf analytic nodes are not postable when leaf-only rules apply
- historical identity/meaning must survive structural changes
- templates are optional/editable setup accelerators, not hard-coded accounting rules
- bank design supports stable ledger account + Bank Account master/dimension as scalable default
- no destructive historical migration without preview/reconciliation/rollback

## Known verification boundary
A real Chromium DOM smoke is now required in CI for completion claims; it exercises the rendered login shell, stubbed post-login transition and the Phase 5 inventory workspace without production credentials. Authenticated production-user E2E and physical-printer validation remain NOT VERIFIED unless explicitly run.

## Successor startup procedure
1. Connect official GitHub and Supabase tools.
2. Verify repository main head and read this file.
3. Read docs/PHASE_1_REDESIGN_VERIFICATION.md, docs/PHASE_2_REDESIGN_VERIFICATION.md, docs/PHASE_3_REDESIGN_VERIFICATION.md, docs/PHASE_4_REDESIGN_VERIFICATION.md, docs/PHASE_5_VERIFICATION.md, docs/PHASE_6_VERIFICATION.md, docs/ACCOUNTING_CORE_ROADMAP_V1.md, docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md.
4. Verify latest Quality/Security/Pages results.
5. Verify Supabase migrations/RLS/advisors.
6. Do not redo Phases 1–3 unless a regression is found.
7. The six-phase roadmap is complete. Continue post-release hardening/source-contract reconciliation from current remote evidence; reopen earlier functionality only for a verified regression or a proven requirement gap.
8. Work continuously: inspect -> implement -> test -> fix -> retest -> commit/push -> verify -> continue.
9. Never report a phase complete until its acceptance criteria and release gates are actually verified.


## Mandatory interpretation of roadmap status

The **current master roadmap is six phases**, regardless of older historical documents that use four phases or labels such as Phase 5–8.

- **Phase 1 — COMPLETED:** scalable UX/product shell and information architecture.
- **Phase 2 — COMPLETED:** master data + accounting-core foundation.
- **Phase 3 — COMPLETED:** double-entry operational accounting and automatic source posting.
- **Phase 4 — COMPLETED:** re-verified with real-DOM smoke plus accounting-invariant execution at `55b62db0` / Quality `36600894426`.
- **Phase 5 — COMPLETED:** complementary ERP/integrations, inventory/costing/assets/multi-currency/settings/permissions/import; production migration applied and behavior/real-DOM/security gates passed.
- **Phase 6 — COMPLETED:** professional reports, controlled historical reconciliation/cutover, QA/security/performance/audit/backup/rollback/release gates; accepted at `6dcb65f1` with Quality `36610113205`, Security `36610113296`, Pages `36610112562`.

Do not confuse the older completed Finora 1.0 four-phase delivery with this current six-phase redesign roadmap.

## How to record future work

For every new material user request, add a row to **Current change ledger** before implementation using one of:
- `REQUESTED`
- `IN PROGRESS`
- `COMPLETED`
- `BLOCKED`
- `DEFERRED`

When completing it, update the same row with commit/migration/test evidence and adjust **Current verified project state / roadmap status / next work** if affected. Do not create a separate private handoff that can drift from this file.

## Required companion evidence

When relevant, verify rather than merely trust:
- `docs/PHASE_1_REDESIGN_VERIFICATION.md`
- `docs/PHASE_2_REDESIGN_VERIFICATION.md`
- `docs/PHASE_3_REDESIGN_VERIFICATION.md`
- `docs/PHASE_4_REDESIGN_VERIFICATION.md`
- `docs/PHASE_5_VERIFICATION.md`
- `docs/PHASE_6_VERIFICATION.md`
- `docs/ACCOUNTING_CORE_ROADMAP_V1.md`
- `docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md`
- `docs/PRODUCTION_RUNBOOK.md`
- GitHub Actions Quality/Security/Pages results
- production Supabase migrations, RLS, advisors and data compatibility

## End-of-session requirement

**Do not leave the project after making durable changes without updating `PROJECT_STATE.md`.**  
If a session is interrupted before the final update, the next worker must first reconcile this file against GitHub/Supabase evidence, then continue.


- 2026-09-29 — **COMPLETED** — Phase 6 implementation is complete through head `6dcb65f1`: professional GL/subsidiary/detail/analytic ledger filtering/drillback, trial balance, P&L, financial position, cash flow, AR/AP aging, project/contract consolidation, and controlled legacy cutover preview/posting. Production reconciliation found 5 formal legacy invoices totaling 3,371,160,000, 2 non-posting pre-invoices totaling 3,570,000,000, 0 account masters and 0 journal vouchers; therefore no unsafe automatic historical posting was performed. Cutover/rollback evidence is in `docs/PHASE_6_CUTOVER_MANIFEST.md`. Quality `36610113205` PASS including Phase 6 behavior and real Chromium DOM; Pages `36610112562` PASS; Security/CodeQL `36610113296` PASS. Phase 6 is accepted under the repository completion rule. Supabase remains at 15 migrations through `20260929172129`; Phase 6 made no schema/RLS/auth mutation; RLS is enabled on profiles/licenses/records.

## Current next executable phase

**Six-phase master roadmap is COMPLETED; post-release source-contract hardening is IN PROGRESS.** Baseline Phase 6 evidence remains `6dcb65f1` / Quality `36610113205` / Security `36610113296` / Pages `36610112562`. The current hardening slice has added Chart-of-Accounts Excel import, four-slot floating-detail compatibility over the generic dimension engine, Contract analytic propagation, account classification, recoverable VAT starter account, negative accounting tests, atomic restore/posted-history protection, expense/income ledger posting, reversed-source immutability and live RLS/admin/license negative evidence. Production now includes migrations `20260929193348 posted_source_immutability_guard` and `20260929193357 accounting_master_uniqueness`; exact SQL is archived under those production versions. Quality run `36620001387` on `768f97ab` passed syntax, application invariants, Phase 2–6 behavior and the Golden Accounting Journey; its only failure was a Playwright style-element text assertion in the newly added print smoke, which is corrected in the next checkpoint and still requires rerun before hardening acceptance. Authenticated production-user browser E2E, physical-printer validation, live third-party webhook delivery, expired-license E2E and leaked-password-protection enablement remain NOT VERIFIED.

## Portable one-line bootstrap

When the owner starts a new ChatGPT/Claude/Gemini/Grok/Codex or other coding session, the minimum bootstrap instruction may be:

`Open GitHub repo davoodmehraban89/Factor-easy on main; read AGENTS.md then PROJECT_STATE.md in full, inspect docs/reference/finora-ui-target-v1.jpg, verify live repo/Supabase state, record my latest request in PROJECT_STATE.md, then resume the exact next executable work autonomously under its five-workstream/high-assurance accounting rules; after every durable checkpoint update PROJECT_STATE.md, and do not stop while approved executable work remains.`

This short prompt is only a pointer. The repository files are authoritative and must contain the full current roadmap, decisions, evidence and next work.
