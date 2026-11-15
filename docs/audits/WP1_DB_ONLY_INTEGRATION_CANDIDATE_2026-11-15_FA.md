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