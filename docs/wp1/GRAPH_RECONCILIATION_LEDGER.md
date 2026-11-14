# Targeted graph reconciliation execution ledger

Plan: MANUAL_RPC_NEXT.md step2. Base: e57e046 (main6f457ff integrated).
Spec: owner-prompts/FINORA_HARDENING_MASTER_2026-11-02_REV2.txt; CLIENT_SYNC_CONTRACT.md.

Task1 is complete at61092e4 with verified Quality/Security/WP1 CI. Task2 is in progress. Tasks3–6 remain pending; this increment does not activate manual server mutations.

Pre-flight interfaces:
- Graph RPC returns organization_id/voucher_id/effective_status/records; client must validate all rows, separate revisions, relationships and status before publication.
- Existing sync uses syncRunning, syncAgain, syncTimer, hydrated tenant/generation and two snapshot maps. Targeted refresh must share that lock and preserve unrelated object identity and pending work.
- Future manual adapter needs a capture made before asynchronous work: voucher ID plus live company/form/edit-revision accessor. A changed form must invalidate refresh even if datastore has not changed.

Ruling: use this tracked ledger and explicit task brief instead of unavailable local skill helper scripts — same baseline, RED/GREEN and evidence contract; cost if wrong is bookkeeping drift, not a runtime behavior change.
Ruling: integrate the three already released UI repairs before client work — avoids testing an obsolete login/navigation baseline; cost is broader integration verification, covered by the full canonical browser suite.

## Step2 brief

Implement capture + refresh API in sync.js. Require a hydrated organization, valid voucher identity and live view context {companyId, formId, editRevision}; reject affected unsaved edits initially and after each await. Queue a refresh behind active sync using the same lock; serialize multiple refreshes, with bounded queue wait. Normal sync requested while refreshing resumes on release. Reject malformed/null/error graph, colliding unrelated IDs and decreasing revisions. Prepare new arrays/maps without mutation, then publish affected records and snapshots together without awaiting; retain all unrelated references and timers. Return effective status as metadata only. Do not mutate the stored voucher status, clear a form or display mutation success. Missing graph is not proof of deletion and never deletes local data.

Behavior tests: clean targeted merge/removal, unrelated dirty data/timers/references, initial and in-flight graph edits, same-user organization change, hydration generation, company/form/revision changes, normal sync on both sides of lock, concurrent refresh, queue/request timeout and late replies, errors/null/invalid rows/versions/links/status, colliding unrelated IDs, new graph, read-only refresh and no mutation RPC. Baseline43 protocol tests PASS after integration. Expected final: all new tests, existing protocol tests, canonical static and browser checks pass. No production activation.

## Verification and independent review

- Initial38cases ran against missing API:12failed, while26negative cases accepted the missing-function rejection too broadly. After tightening expected error codes, all45final cases fail against the actual e57e046 baseline source (0pass/45fail), and all45pass against the implementation. Existing43protocol cases also pass. Four extra cases verify complete1003records, canonical JSON equality, queued view change and unhydrated tenant;85/85 passed. One test initially assumed array order rather than voucher identity; corrected lookup to the explicit voucher ID (no behavior assertion removed).
- Independent reviewer /root/graph_reconciliation_review read the increment and integration, independently passed85 tests and reproduced two Important races. No Critical or Minor findings. This is client/integration review, not independent SQL approval.
- Final fix1: older full hydration could overwrite a successful targeted publication; added reverse-order regression (RED: missing expected rejection), then advance sync generation on targeted publication. Older queued captures also reject conservatively and require a fresh capture.
- Final fix2: pre-failure syncAgain could be revived by graph completion after an uncertain writer; added regression (RED: unexpected retry timer), then clear that stale intent at preservePending failure. Added positive case ensuring a new explicit save during the following graph read still resumes.88/88Node now pass;55final static/server/release commands pass. Complete final browser verification remains in progress.
- Final: Ruling: SQL correctness, actual Auth/JWT/PostgREST, production/schema/performance and manual steps3–6 are not established by this client review — retain existing gates and remaining tasks; cost if misinterpreted is premature release, prevented by draft PR and no activation.
- Final: Ruling: coordinator owns full browser/static evidence rather than attributing it to reviewer — results and exact commands are recorded separately; cost if omitted is incomplete verification, so no acceptance is claimed until those runs finish.

- Final canonical source/browser run:250/250PASS (5.5m). An earlier final run was interrupted at192/250 across the session gap and is not counted. The preceding249case integration run passed but is not the final-fix acceptance; the complete250case run above is the final source/browser evidence. Generated Pages11/11PASS (7.9s).
- Remote documentation baseline ab7fea4 subsequently verified allSUCCESS: Quality42948390999,Security42948391034,WP142948391112. These do not substitute for CI on the forthcoming implementation commit.

Task2: implementation complete locally (base e57e046; final code/test hashes in evidence/graph-reconciliation/result.json). Tests: node --test scripts/wp1-client-capability-test.mjs scripts/wp1-graph-reconcile-test.mjs →88/88; canonical quality workflow browser command→250/250; same sync spec on generatedPages→11/11;54quality commands+release safety→55/55. Published exact-head CI remains a separate gate.
Next task: MANUAL_RPC_NEXT steps3–4, explicit manual form adapter and truthful mutation/retry outcomes. Capture expected revision when opening edits; preserve form identity and account binding through each await, including the snapshot generation advanced by this refresh. Do not globally replace synchronous engine callers. Delete requires an explicit confirmed-deletion reconciliation contract; null read is not deletion proof. No production enablement before remaining contracts/gates.
