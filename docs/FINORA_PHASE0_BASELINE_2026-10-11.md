# Finora Phase 0 — Live baseline, defect prioritization and first execution checkpoint
**Date:** 2026-10-11 | **Roadmap:** `docs/FINORA_EIGHT_PHASE_APPROVED_ROADMAP_2026-10-11.md` | **Phase status:** STARTED / **NOT ACCEPTED**.

## Verified baseline — read-only
- **Production code:** canonical main `4071072bc457fede62097eb2300ca35b8f516939`, merged PR #72 (documentation only after print improvement PR #71). Exact commit: GitHub Quality `38142829987` SUCCESS; Security `38142829957` SUCCESS; Release gate `38142911889` SUCCESS; gated Pages deploy `38142924226` SUCCESS.
- **Database:** Supabase `hcsixhqbyuhpshfwqpjx` `ACTIVE_HEALTHY` and 80 recorded migrations; newest `20261007165208 phone_identity_profile`. No schema, data, RLS or credential changes in this verification.
- **Security advisories requiring careful review, not blanket disablement:** `authenticated_security_definer_function_executable` WARN=21; `rls_enabled_no_policy` INFO=3; `auth_leaked_password_protection` WARN=1. Distinguish intentional private access contract from an actual excess privilege.
- **Open unmerged PRs:** #6, #28, #39, #40, #43, #49, #57, #58. Some overlap with already-merged features. None were integrated as part of roadmap approval.
- **Desktop Commander:** `DESKTOP-71SJ63M` online. New explicit PowerShell GET check of `https://factoreasy.ir/?phase0Baseline=20261011`: HTTP 200. Deployed HTML references `js/print.js?v=20261011-persian-print-v1`, `js/ux-hardening-r2.js?v=20261011-product-refresh-v3`, `js/login-connectivity.js?v=20261011-login-triage-v1`. Exact visible JS paths independently returned HTTP 200, with `localizePrintHtmlDigits` and `syncProductSelectOptions` present. **This proves asset reachability, not login or data persistence.**
- **Prior Chromium controlled QA, not rerun as user-authenticated today:** search `بلوک`/`هارد`, selection/amount metadata from transient synthetic products on real `factoreasy.ir` PASS; formal invoice print synthetic test PASS, zero Latin/Eastern Arabic visible numeral glyphs; taxpayer print test 4/4 on authorized remote Chromium. See `PROJECT_STATE.md` for exact evidence and limitations.

## Phase 0 prioritized acceptance backlog
All items remain **OPEN or UNVERIFIED** unless specifically shown otherwise. Fix tests before claiming remediation.

| ID | Priority | Owner | Test & expected behavior | Current evidence | Exit criterion |
|---|---|---|---|---|---|
| `F0-01` | **P0** | QA / auth | Login from owner's affected ISP, diagnostics result and authenticated reload; no repeated generic network error. | Site + Supabase synthetic auth probes working from remote; affected ISP user session unverified. | Real authorized login/refresh succeeds, or reproducible failure is isolated to network, DNS, auth, device with verified mitigation. |
| `F0-02` | **P0** | UX + data integration | Existing customer tenant: invoice items, type `هارد` or known `بلوک` and inspect real list; select product and verify unit/price. Also existing contact/seller lookup. | PR #69 released and synthetic Chromium passed; real account catalog not authenticated-verified. | Item appears for authorized company, with correct option on click/filter and row metadata after selection, and no other tenant leaked. |
| `F0-03` | **P0** | Commerce / QA | Isolated safe invoice create→save→navigate→reload→edit→print; verify no lost item, duplicate invoice or incorrect totals. Avoid writing disposable test finance into real production. | Previous save/reload fixture blocked by null `currentUser`; this did **not** establish product bug. | Controlled session persistence and failure/retry tested; approved real tenant smoke if safe. |
| `F0-04` | **P0** | Finance print / QA | User-authenticated pre-existing formal/nonformal/purchase/taxpayer print preview, Persian dates and serial, all lines, single-page/reference layout where required, printer differences. | PR #71 deployed; synthetic real-domain print PASS; physical printer and actual saved invoice unverified. | Real visible print and PDF match source amounts, with Persian readable digits; no unexpected pagination. |
| `F0-05` | **P1** | UX / performance | 1,000+ authorized product/contact/account/project/contract options: click shows list, typing filters quickly without blocked UI, keyboard/Escape/selection works. | Earlier 60 controlled DOM and inline-combobox tests; exhaustive 1,000+ stress unverified. | Recorded browser budget and bounded response time; no missing results or selection corruption. |
| `F0-06` | **P1** | UI / QA | Keyboard, modal/Escape, all critical save/delete/import/export controls, RTL scroll ownership, dark/light display across main workflows. | Partial controlled tests; screenshot-specific user acceptance pending. | Critical flow controls are exercised and evidence linked to screenshots/test traces. |
| `F0-07` | **P0** | Security / release | Review production role boundaries before any actual invoice posting or restoration; confirm tenant security gate and rollback path. | Existing RLS/contracts, advisories and CI; true two-user E2E and full migration body-equivalence not verified. | No unapproved auth/schema/data changes; any unsafe path blocked and assigned to Phase 1 with risk owner. |
| `F0-08` | **P1** | Coordinator / documentation | Reconcile unmerged historic PRs against main to avoid duplicate regressions, and pin exact green CI for every accepted fix. | Eight open PRs, current green main head. | Each PR labeled as obsolete, needs audit or relevant; only vetted work merged. |

## Phase 0 stage-based work queue
**Slice A — started, read-only baseline DONE:** production source/CI, migration/security advisor inventory, domain asset HTTP smoke; evidence above.

**Slice B — next:** create reproducible isolated fixture for `F0-03` and repeat persisted invoice open/edit/reprint, and verify actual login flow `F0-01` without collecting passwords. Keep this as a bounded PR with independent regression gate. Run performance scan `F0-05` in parallel if independently testable.

**Slice C — requires owner/session:** `F0-01`, `F0-02`, `F0-04` tests on the already-authenticated real user browser/network and a pre-existing saved invoice. No credentials must be sent. An authorized screenshot or diagnostic status suffices as input; not a blanket permission to modify finance records.

**Exit status:** `PHASE 0 OPEN`. Baseline verified, but not full phase acceptance.

## Execution restrictions and carry-forward
- Roadmap signoff is not permission to change production authentication, credentials, RLS, schema, membership, finance history, or real customer data. Require discrete owner approval for sensitive / irreversible changes and production accounting cutover.
- Rollback for these docs: revert the dedicated documentation PR. Live application runtime unchanged by this checkpoint.
- Next manager: start with `F0-03` isolated persistence regression and prove write/reload semantics, then reproduce or verify `F0-01` from affected user network; close each with exact evidence and update `PROJECT_STATE.md`.
