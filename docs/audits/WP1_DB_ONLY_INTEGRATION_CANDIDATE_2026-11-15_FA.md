# بسته انتقال کنترل‌شده WP1 به main — ۱۴۰۵/۰۸/۲۴

## دامنه

- مبنای دقیق: `main` در `dab1a45fcfc4f12e675cfe055e477138cd3e99fa`.
- منبع نامزد: PR #195، head `1e03964aeeb0714130ca561f424916bd06259a2e`، که stacked روی PR #194 است.
- شاخه مقصد: `integration/wp1-ledger-core-20261115`.
- این بسته فقط لایه SQL/DB candidate و آزمون‌های PostgreSQL ایزوله را منتقل می‌کند؛ هیچ UI/client sync، purchase UI، identity/login، سازمان/RBAC، quality workflow اصلی یا تغییرات عمومی PR194/195 را منتقل نمی‌کند.
- 16 migration مالی (11 archived prerequisites + 5 additive corrections), 16 conservative rollback files, 17 SQL regression tests, disposable PostgreSQL harness, test runners, platform bootstrap fixture and dedicated WP1 CI workflow.

## چرا انتقال کامل PR195 انجام نشد

PR195 از شاخه قدیمی WP0 منشعب شده و با main فعلی diverged است. تغییرات cumulative آن شامل تغییرات ورود، bootstrap، navigation، سازمان، sync client و آزمون‌های نامرتبط نیز هست. انتقال مستقیم یا cherry-pick کور می‌تواند نسخه‌های قدیمی فایل‌های اصلی را بازگرداند. بنابراین فقط مسیرهای مالی مستقل و harness لازم برای اثبات آن‌ها منتقل شده‌اند.

## گیت‌های فنی

1. همه 16 migration به‌عنوان candidate منتقل شده‌اند؛ هیچ‌کدام روی Production اجرا نشده‌اند.
2. همه 16 DOWN script فقط conservative rollback هستند؛ مستندات candidate می‌گویند این rollback به schema pristine برنمی‌گردد و بعضی helper/index/counterهای inert را نگه می‌دارد.
3. تست‌ها بر source-derived disposable PostgreSQL 17 و bootstrap شبیه‌سازی‌شده اجرا می‌شوند؛ Auth/JWT واقعی، gateway/PostgREST، catalog زنده Production و parity کامل را اثبات نمی‌کنند.
4. پیش‌فرض guard mode برابر audit/shadow است؛ هیچ enforcement یا cutover تولیدی در این بسته فعال نمی‌شود.
5. این انتقال هنوز نیازمند اجرای CI روی exact head، بازبینی مستقل SQL/ACL/RLS، بررسی ترتیب migration روی baseline فعلی main و رفع خطاهای احتمالی است.
6. manual UI RPC adapter، purchase correction/cancel transaction، cheque adapter، entity-backed dimensions/account rules، source-specific acceptance، latency، schema parity/shadow audit، real Auth/JWT/PostgREST، backup/restore و G1 rollout package خارج از این بسته و همچنان باز هستند.

## فایل‌های منتقل‌شده

- 16 migration + 16 rollback
- 17 SQL regression fixtures
- `scripts/wp0-ledger-harness.mjs`
- 9 WP1 runner/concurrency scripts
- `supabase/tests/wp0_platform_bootstrap.sql`
- `.github/workflows/wp1-ledger.yml`

## اجرای محلی این محیط

Docker در محیط اجرایی فعلی نصب نیست؛ بنابراین اجرای PostgreSQL محلی در این نشست ممکن نبود. اجرای واقعی باید از workflow اختصاصی GitHub Actions روی همین commit تأیید شود.

## تصمیم

این PR فقط یک **integration candidate برای review و CI** است، نه تأیید merge و نه مجوز اجرای Production. اگر CI یا بازبینی SQL/ACL شکست بخورد، تا رفع و تکرار آزمون‌ها ادغام ممنوع است.

## CI finding and prerequisite repair — 2026-11-15

The first exact-head WP1 workflow run stopped in the baseline RED fixture before applying any WP1 migration. The captured PostgreSQL error was `column "phone" of relation "profiles" does not exist`, raised by the existing `public.handle_new_user()` trigger when the synthetic `auth.users` row was inserted.

Root cause: the current main source tree does not contain the historical migration `20261007165208_phone_identity_profile.sql`, while the disposable WP1 harness explicitly includes this timestamp in its selected baseline migration set. The archived migration exists on the WP0 candidate branch and records that it was recovered read-only from `supabase_migrations.schema_migrations` on 2026-11-02 as already applied in Production.

Repair: port only this single historical prerequisite migration from WP0 into this candidate. This is a source-history/schema-parity repair, not a WP1 financial migration and not an instruction to reapply it in Production. The harness already selects this exact migration timestamp; no test was weakened and no synthetic schema shortcut was introduced.

The next exact-head CI run must prove the baseline stage progresses past auth-user bootstrap. The remaining WP1 SQL stages are still unverified until the workflow completes.

## Independent SQL review finding — guard audit tenant boundary

The read-through of the staged SQL found that `private.finora_phase1a_log_guard(uuid,text,text,text)` was `SECURITY DEFINER` and executable by `authenticated`, but accepted a caller-supplied organization ID without verifying active membership. The trigger needs authenticated execution to record audit-mode violations, so simply revoking the grant would break the `SECURITY INVOKER` trigger path. However, as written, a member of organization A could directly invoke the function with organization B and append a forged `guard_violation` row to B audit history.

An additive candidate migration `20261115130000_wp1_guard_audit_tenant_scope.sql` now checks that `auth.uid()` is an active member of the supplied organization before writing and bounds audit input. A synthetic SQL regression `wp1_guard_audit_tenant_scope.sql` verifies that cross-tenant injection is denied while same-tenant trigger logging remains available. A conservative DOWN restores the prior logger body; it does not remove audit history.

This is a code-review-driven patch, not yet validated. It is included in the disposable WP1 suite and must pass the next exact-head CI run. It does not change the audit/shadow default, enable enforcement, or authorize Production.

## Independent SQL review finding — dimension type/value integrity

The current saved-journal validator verified that a dimension type and dimension value both belonged to the company, but did not verify that the selected value actually belonged to the selected type or that either entity was active. This allowed semantically invalid analytic tags to be attached to an otherwise balanced voucher.

Candidate correction `20261115140000_wp1_dimension_value_type_scope.sql` now requires matching `dimensionValues.dimensionTypeId`, company scope, and active type/value state before accepting the journal graph. The regression `wp1_dimension_value_type_scope.sql` proves mismatched type/value and inactive values are rejected without leaving a partial draft, while a valid pair still posts. The DOWN restores the prior validator.

This patch is candidate-only and awaits the full disposable CI run. Account-specific required/optional dimension rules remain unimplemented and are still an explicit blocker; this correction does not claim to complete entity-backed dimension policy.

## Reversal regression fixture correction — 2026-11-15

The latest exact-head WP1 run passed the expected RED baseline and all green SQL fixtures through `wp1_posting_negatives.sql`, including the 1,000-event seed. It then failed while seeding the deliberately foreign-tenant `FOREIGN_DIM` row in `wp1_reversal_dimensions.sql`: the fixture had kept actor A in `auth.uid()` while inserting a row owned by tenant B. The new tenant-scoped audit guard correctly rejected and audited that cross-tenant setup write before the actual reversal assertions ran.

This was a fixture-actor error, not evidence that the reversal RPC is broken. The fixture now switches the synthetic JWT subject to tenant B owner only for the privileged setup insert, then restores tenant A before running the authenticated negative cross-tenant reversal assertion. No assertion was removed or weakened. The complete workflow must rerun on this exact updated head.

## Scope-move audit assertion correction — 2026-11-15

After correcting the foreign-tenant reversal fixture, `wp1_reversal_dimensions.sql` passed in full. The next fixture `wp1_scope_move_and_null.sql` then reached its final audit-to-off relocation scenario and failed because the test expected the guard event in the destination organization. The source migration invokes the guard logger with the NEW organization on UPDATE, but the actor remains a member of the source organization; the tenant-scoped audit writer correctly refuses to let that actor write an audit row into the destination tenant.

The event is evidence of an attempted mutation of the source tenant’s posted journal identity. The test assertion is corrected to require the event in the source organization, with the source actor and voucher ID. The relocation behavior and all negative assertions remain unchanged. This is a test expectation correction based on the intended audit ownership, not a production-function change. Full exact-head CI is still required.

## Source-tenant audit attribution correction — 2026-11-15

The exact-head WP1 rerun confirmed `wp1_reversal_dimensions.sql` passes and exposed a real guard-function issue in `wp1_scope_move_and_null.sql`: when a posted voucher is moved between organizations while the source is audit and destination is off, `finora_phase1a_guard_server_journal_fields` derives the logger organization from NEW row scope. It then tries to write the guard event into the destination tenant, where the source actor is not a member; the tenant-scoped logger correctly rejects this. Added migration `20261115150000_wp1_scope_move_audit_source_tenant.sql` to attribute identity-move guard events to OLD/source organization, plus a conservative DOWN restoring the prior function. Existing fixture expects source tenant, source actor and voucher ID. Exact-head CI must validate UP/DOWN and all regressions before any merge.

## Final exact-head CI result — commit `42a044f7b53a53fa7b8a3a82fa3c5d87e0004da0`

All three dedicated checks completed successfully on the exact PR head:
- `WP1 disposable ledger proof`: success. Baseline RED detected the expected missing guards; all green fixtures passed, including the 1,000-event/two-organization randomized property suite, reversal dimension preservation, scope-move/null behavior, and two-session concurrency. The candidate correction cycle verified UP/DOWN/UP with retained history. The full candidate conservative DOWN/UP verified 11 prerequisites and 8 correction migrations, restoration of baseline functions/ACLs/triggers, unchanged retained rows, and re-enforcement of D1/D2 in the disposable environment.
- `Security checks`: success (CodeQL and release/QA safety invariants; dependency review skipped by workflow conditions).
- `Quality checks`: success (static quality and three database quality jobs).

## Post-CI integration review — manual journal UI remains a hard blocker

Review of the exact same commit's application sources found that the database RPC surface is not yet the application's journal mutation path:
- `js/journal-engine.js` still implements `jeCreateDraft`, `jePost`, `jeReverse`, `jeUpdateDraft`, `jeDeleteDraft` by mutating local `datastore` and calling `saveDatastore()`.
- `js/journal-ui.js` calls those synchronous legacy functions directly from `jeSaveManual`, `jePostUi`, and `jeReverseUi`.
- `js/sync.js` persists generic collection diffs through `sb.rpc('finora_sync_records', ...)`; it does not invoke the dedicated `finora_journal_create_draft`, `finora_journal_update_draft`, `finora_journal_post`, `finora_journal_reverse`, or `finora_journal_read_graph` RPCs.
- Existing browser workflow tests exercise the generic sync mock; they do not prove that the live journal form uses the new dedicated journal RPC surface.

Therefore a green database-only proof is not end-to-end accounting acceptance. The next work package must create an asynchronous journal repository/adapter, route manual draft create/update/post/delete/reverse and journal read graph through the dedicated RPCs, reconcile authoritative server responses into the UI state, and test retries, version conflicts, permission failures, and partial network failure. Source-driven sales/purchase/treasury posting must be migrated separately and not silently left on generic sync.

## Gate decision

PR206 remains Draft and is not merged. No Production database, migration, data, Auth/RLS, role/grant, deployment, or live service has been changed. Remaining pre-merge gates include independent SQL/ACL/RLS review, live schema and Auth/JWT/PostgREST parity, the manual UI RPC adapter, source workflow adapters, account-specific required/optional dimension rules, performance evidence, and backup/restore rehearsal.