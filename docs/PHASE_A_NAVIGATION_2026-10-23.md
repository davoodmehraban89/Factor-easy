# Finora Phase A — navigation and command contract

## Scope and baseline

Owner request dated 2026-10-23 authorizes Phase A only, on `main` baseline `bccd474433b4188e43aae345773498ea6fc65209`. The detailed execution prompt in this session is the specification. The existing IIFE/global JavaScript, HTML shell, view IDs, task selectors, entitlement guards, colors and edge handle stay in use. No dependency, SQL, production database operation, accounting calculation or frozen office/workflow/OCR/SLA behavior is changed.

The direct registry/HTML adjustment is the implementation approach: a second navigation registry or replacement shell would duplicate working routing. The old commerce invoice-type selector remains usable; separate sales/purchase commands point to its existing two views. Existing combined ledger and treasury tasks remain working projections; unimplemented templates, separate daybook, closing and returns workflows are not advertised.

## Implementation plan

- [x] Pin the default rail to eight ordered modules: dashboard, accounting, commerce, treasury, inventory, projects, reports, settings, using the owner's exact Persian labels.
- [x] Expose explicit sales/purchase commands through `FINORA_MODULES` / `FINORA_COMMANDS`; keep report deep links and existing accounting task focusing.
- [x] Remove assets/enterprise static rail buttons and enterprise/office/requests runtime rail injection. Preserve licensed launcher entries, navigation guards and command search. Provide a visible launcher button and relocate organization/access utilities outside the module rail with their existing permissions and handlers.
- [x] Check command availability against implemented views/renderers; omit unavailable actions without placeholder labels. Do not create new financial workflows for missing menu items.
- [x] Add real-DOM regression assertions, observe failure on baseline, implement, and run existing affected checks plus CI's static/behavioral and Chromium suite. Preserve existing print tests and Golden accounting expectations. Review the complete diff independently.
- [ ] Commit/push this branch, open one scoped PR, inspect exact-head Quality/Security including disposable DB jobs, and record actual PASS / NOT VERIFIED evidence. Stop before Phase B and merging.

## Review focus

- Rail remains eight items after delayed extension bootstrap, login and repeated refresh, including users with multiple organizations.
- Licensed extras remain reachable from the visible launcher; unlicensed modules remain blocked and admin-only commands remain guarded.
- Purchase click/search opens the actual purchase surface; sales stays in its existing surface, and neither navigation writes accounting records.
- Accounting entry/register/trial links focus existing cards; report module uses the same reporting view/task.
- Cold startup and generated Pages artifact keep the same navigation behavior, and existing A4/A5 print isolation passes.

## Reported differences

- Prior roadmap restrictions describe a previous Phase 0 request; the current owner explicitly authorizes A.
- IA v2 lists assets in the rail and places projects before inventory. This PR follows the current eight-module list.
- Old commerce checks prohibit a separate purchase item and require generic «فاکتورها». Their assertions must follow the current owner contract without weakening financial checks.
- Organization utilities are injected into the rail by two extensions; their placement must change to preserve the exact eight-module contract. Their operations/permissions are retained.
- Repository reference JPG is 384×216, although AGENTS describes its source as 1536×864. No replacement design is introduced.

## Verification evidence

Baseline remote `main` Quality [38869588407](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38869588407) and Security [38869588431](https://github.com/davoodmehraban89/Factor-easy/actions/runs/38869588431) were verified successful. Remote `main` remained `bccd474433b4188e43aae345773498ea6fc65209` before this PR.

Actually executed locally:

| Check | Actual result |
| --- | --- |
| Baseline syntax / Golden | PASS (55 JS modules + 54 MJS scripts; existing Golden unchanged) |
| New Phase A tests on unchanged application | 3 expected failures: extra rail buttons, missing visible launcher, missing purchase command registration |
| Same Phase A tests after implementation | 3/3 PASS; exact rail after repeated organization refresh, real purchase/search/accounting/report clicks, licensed launcher and missing-implementation filtering |
| All static/behavioral/backup/safety commands from Quality plus release safety | 50 commands, 0 failures, including Golden |
| Exact existing CI Chromium spec list, `--reporter=line --workers=1` | **126/126 PASS** in 2.9 minutes (baseline 123 + 3 new), including isolated A4/A5 PDF, purchase/taxpayer print and generated Pages CSP navigation |
| Final syntax, quality, login connectivity, generated public regression, Golden and release safety after cache fix | PASS; `git diff --check` PASS |
| Synthetic 1536×864 source-shell visual inspection | Rail labels/order and sales/purchase context fit existing shell; screenshot inspected locally, no customer-data use |
| Independent complete-diff review | No remaining critical/important/minor findings |

Environment note: initial existing PDF test failed before application edits because this cloud image prioritizes system WOFF2 fonts that Chromium renders with zero text width. A temporary `FONTCONFIG_FILE=/tmp/finora-fontconfig-no-woff2.conf` excludes those fonts only for local browser processes; the unchanged PDF assertion then passed. No repository font, print code, dependency or CI setting was modified for this environment repair.

Two issues found during test/review were fixed and verified: enterprise uses its existing lazy view factory before first launcher navigation; bootstrap and changed extension URLs use `20261023-phase-a-navigation-v1` so a cached previous manifest cannot restore removed rail items. Bootstrap cache assertion was observed RED then GREEN. Existing mixed accounting/treasury enterprise tasks remain available through their guarded command-search routes as on baseline; no duplicate launcher catalog or permission-refresh behavior was invented.

Exact PR-head CI (including three disposable PostgreSQL jobs) is pending remote execution; local Chromium/fixture success does not establish production accounting or customer acceptance.

## Changed files

- Shell and extension URLs: `index.html`, `js/ui.js`, `js/bootstrap.js`.
- Launcher and organization utility placement: `js/platform-modules.js`, `js/organization-shell.js`, `js/organization-rbac.js` (DOM placement only; permission predicates/RPCs unchanged).
- DOM/static contracts: `scripts/dom-smoke.spec.js`, `scripts/platform-office.spec.js`, `scripts/phase0-modal-dashboard.spec.js`, `scripts/pages-artifact.spec.js`, `scripts/shell-scroll-ownership.spec.js`, `scripts/commercial-rnd-check.mjs`, `scripts/quality-check.mjs`, `scripts/login-connectivity-check.mjs`.
- Continuity/evidence: `PROJECT_STATE.md`, this report.

No `supabase/`, financial engine/source-posting or print implementation file changed. README's previously documented single-file wording is outside this navigation PR.

**NOT VERIFIED:** real owner-ISP login, physical printer output, two simultaneous users on production, customer acceptance. No Supabase production access or migration is part of Phase A.

Rollback: revert this navigation PR; financial data/schema remain untouched. Next phase requires a fresh owner instruction after this phase is reviewed.
