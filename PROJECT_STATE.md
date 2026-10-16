# PROJECT STATE — FINORA 1.0 / FACTOR-EASY (فشرده‌شده در فاز صفر)
> **مرجع اجرایی جاری برای AI و توسعه‌دهندگان** · مخزن `davoodmehraban89/Factor-easy` · شاخه محافظت‌شده `main` · تاریخ ۱۴۰۵/۰۷/۲۴.
> **تاریخچه کامل بدون حذف یک بایت:** [`docs/archive/PROJECT_STATE_PRE_MASTER_PHASE0_2026-10-16.md`](docs/archive/PROJECT_STATE_PRE_MASTER_PHASE0_2026-10-16.md). Blob SHA پیش/پس از آرشیو: `4e8adb5c82b4c7e5d16f26c94cc904ba5774bca6`، ۲۹۰٬۹۱۳ کاراکتر، ۸۰۹ خط؛ برای جزئیات هر فاز/شناسه PR و تصمیم‌های قدیمی به همین سند رجوع شود. آرشیو را بدون درخواست مالک تغییر ندهید.

## ۱. اصول و اختیار
- قبل از کار `AGENTS.md`، `README.md` و **همین فایل** را بخوان؛ از وضعیت زنده `main`، CI، نسخه استقرار و در کارهای مرتبط Supabase را مستقل اطمینان بگیر. آخرین درخواست مالک نسبت به تاریخچه اولویت دارد. تاریخچه پشتیبان، ادعای اجرای فعلی نیست.
- هماهنگ‌کننده مسئول اجرا/QA/امنیت/مستندات است. بدون ابزار واقعی ادعای ایجنت موازی نکن. تغییرات کوچک و قابل بازگشت، شاخه و PR مستقل؛ نتیجه واقعی با SHA و لاگ تست. CI موفق ≠ تایید مرورگر مشتری.
- **مرز توقف:** تغییر schema/RLS/Auth/role/grants، بازنویسی تاریخچه مالی، عملیات مخرب، cutover یا هزینه و ارسال بیرونی نیازمند اجازه صریح جداگانه است. شرکت/tenant/RLS، تاریخچه posted، audit و idempotency حفظ شود؛ سرویس پولی یا کارت بین‌المللی راه‌حل اجباری نباشد.
- هر migration تولیدشده باید فایل واقعی در `supabase/migrations/` داشته باشد؛ فقط محیط تست مستقل، rollback، و مجوز عملیات Production. اسناد قطعی را بازنویسی نکن؛ اصلاح با تاریخچه برگشت و سند جدید.
- ماژول‌های اتوماسیون اداری، workflow، OCR و SLA موجود **فریز**ند، حذف یا توسعه نمی‌شوند مگر درخواست جدید مالک. معماری UI مرجع: `docs/reference/finora-ui-target-v1.jpg`.

## ۲. تفکیک نقشه‌راه‌ها
- **پرامپت جدید مالک** `finora-master-prompt-cloud.md`، اجرا فقط **فاز به فاز**: ۰ ممیزی/فشرده‌سازی؛ ۱ هسته مالی سمت سرور؛ ۲ موتور سند خودکار؛ ۳ سلامت دفتر؛ ۴ تجربه کاربر؛ ۵ آمادگی فروش. **فقط فاز ۰ در این PR مجاز است.** فاز ۱ به مجوز مشخص تغییر اسکیما و محیط تست مستقل نیاز دارد.
- نقشه راه هشت‌فازی قدیمی در `docs/FINORA_EIGHT_PHASE_APPROVED_ROADMAP_2026-10-11.md` محفوظ است؛ نام فاز صفر آن «پایداری/ورود» با فاز صفر جدید «ممیزی سند مالی» **یکی نیست**. شماره فاز قدیمی را به جای فاز جدید گزارش نکن.

## ۳. آخرین baseline قابل اتکا
- **قبل از ممیزی جدید:** protected `main` = `612998edb51274ac1e6136a31265cd17b9abd265` (PR #158، حذف درخواست تکراری `enterprise-iran.js`). GitHub exact-SHA Quality `38815971255` **123/123 Playwright PASS**، Golden Accounting PASS، هر سه Postgres disposable jobs PASS؛ Security `38815971233`، Release Gate `38816410495`، gated Pages `38816440543` همگی SUCCESS.
- اصلاح تکرار JS بر اساس CDP/Playwright بود؛ **ورود سرد/پایداری اینترنت رایانه مالک همچنان تأیید نشده**. Issue #106 باز بماند. Product+buyer live lookup در یک حساب تست/کار read-only قبول شده، ولی ذخیره/چاپ واقعی و مالک-ISP cold login جداگانه باز است.
- Supabase Production با ref `hcsixhqbyuhpshfwqpjx` شناخته می‌شود؛ تاریخچه پیشین حدود ۸۲ migration تا ۱۴۰۵/۰۷/۲۱، drift آرشیو `phone_identity_profile` و warningهای امنیتی ثبت شده‌اند. **در ممیزی جدید Supabase Production فقط read-only catalog بررسی شد: وضعیت `ACTIVE_HEALTHY`، ۸۲ migration، آخرین `20261012075507`، فقدان ستون `records.version` و RPC `finora_post_event`، وجود دو امضای ۲/۳ آرگومانی `finora_sync_records`، و تریگرهای journal فقط UPDATE/DELETE. هیچ داده مالی/DDL/DML خوانده یا تغییر داده نشد.** بدون preflight ادعای وضعیت زنده امروز نکن.

## ۴. فاز صفر جدید پرامپت مالی — خروجی/مرز
- **مالک کار:** هماهنگی + ممیزی مالی/کیفیت. **ورودی:** SHA ثابت بالا، JS مالی، SQL migration، workflow و فایل پرامپت کاربر.
- **خروجی:** `docs/EVENT_COVERAGE.md` (جدول رویدادها، سند خودکار/مشروط/مفقود و همه مسیرهای دستی)، `docs/TEST_AUDIT_PHASE0.md` (۳۸ مجموعه Playwright + ۳۵ چک ایستا/regex + ۱۴ رفتاری/ترکیبی + ۵ ابزار)، `docs/PHASE0_FINANCIAL_AUDIT_2026-10-16.md` (گزارش یک‌صفحه‌ای، P0/P1 و مرز تست) و آرشیو کامل تاریخچه.
- **یافته فنی:** موتور اصلی `jeCreateDraft/jePost/jeAutoPost` مرورگری است؛ `finora_sync_records` رکورد JSONB را upsert می‌کند؛ guardهای posted روی UPDATE/DELETE هستند و INSERT زیر سند posted فاقد حفاظت هم‌ارز است؛ `jeNextNumber` سمت مرورگر اجرا می‌شود. عدم تعادل/هم‌زمانی و source-idempotency سراسری هنوز بر سرور با تست‌های منفی فاز ۱ تأیید نشده است.
- **خطرات دیگر:** چک مستقل، COGS، FX، closing/opening، VAT settlement و بخشی از چرخه برگشتی سند خودکار ندارند؛ `js/sync.js:139–143` رشته‌ها را با `neutralize` دگرگون می‌کند. در فاز ۰ هیچ مورد اصلاح عملیاتی نشده است.
- **تست موجود baseline:** `123/123` Chromium + Golden + ۳ DB و Security PASS (با شماره اجرا در بالا)؛ تست واقعی ۱۰۰۰ رویداد تصادفی، concurrency مالی و production E2E را **NOT VERIFIED** ثبت کن. تست‌ها از source/CI بررسی شده‌اند؛ clone به محیط محلی این چت به دلیل DNS ممکن نبود.
- **تغییرات این فاز:** چهار فایل سند/آرشیو، همین خلاصه، و افزودن اجرای `public-qa-regression-check.mjs` به Quality CI؛ **هیچ کد JS، اسکیما، Production SQL، نقش یا داده مالی تغییر نکرده است.** برای تکمیل، PR scoped باید Quality/Security موفق و یکپارچگی آرشیو تأیید شود.

## ۵. تعهدها/کارهای معوق (در فاز صفر انجام نشد)
- فاز ۱ جدید تنها پس از دستور صریح مالک + دسترسی به Postgres آزمایشی مستقل و preflight/rollback: deferred balance+min lines، guard درج، optimistic version، شماره سند تراکنشی، قفل دوره، ممیزی append-only، event RPC/idempotency و گزارش read-only ناسازگاری تاریخی.
- Issue #106 ورود روی اینترنت مالک، آزمون واقعی تسویه/چاپ، QA دوکاربره tenant، رفع drift مایگریشن، Leaked Password Protection و بکاپ رمزنگاری‌شده Production + کپی بیرونی + بازیابی آزمایشی همچنان **OPEN / NOT VERIFIED**. بدون مجوز در این موارد کاری نکن.
- مدارک مرجع دیگر: `docs/FINORA_OFFLINE_BACKUP_FA.md`، `docs/FINORA_PHASE0_ACCEPTANCE_REGISTER_2026-10-12.md`، `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` و آرشیو کامل بالا.

## ۶. ثبت پایان این نوبت
- درخواست مالک در ۱۴۰۵/۰۷/۲۴: «پرامپت را کامل مبنا بگیر؛ **فقط فاز ۰** را اجرا کن و بعد از پایان گزارش خلاصه بده؛ ادامه فاز ۱ با دستور جداگانه».
- شروع از `main` SHA بالا، ایجاد شاخه `audit/finora-master-prompt-phase0-20261016`، آرشیو کامل و گزارش‌ها تولید شد. **وضعیت QA این شاخه باید از GitHub PR-head جدا بررسی شود**؛ تایید نهایی فاز فقط با قبولی آن و ادغام مستندات معتبر است.

### 2026-10-16 Phase 0 post-merge Chromium intermittent fixture (QA-only follow-up; NOT application defect proven)
- **Original Phase 0 PR:** #160 merged exact-main `67be4fbfa6161156b10ce6279445266c989e97d3`. PR-head Quality `38867730181` 123/123 Chromium PASS, isolated DB and Security PASS. Protected main Quality `38868319174` attempt 1 **FAIL 122/123** at `scripts/phase0-invoice-persistence.spec.js:52`, `#auth-screen` remained visible for 5 seconds; all three DB jobs and Security `38868319200` succeeded. Same-SHA failed-job rerun attempt 2 was requested; result must be verified separately. Neither result proves actual production financial persistence or login failure.
- **Source-reproduced test harness race:** `authenticatedMockBrowser` waits only for `enterApp`, `commitSaveInvoice`, `pullAll` functions before installing a fake authenticated identity; asynchronously loaded `organization-rbac` wrapper can supersede the fake identity. Prior `scripts/accounting-document-workflow.spec.js:36–43` already fixes the identical fixture ordering issue by waiting for `FinoraStartupStatus.extensionsReady`, zero failed extensions, and `authChecked`. Apply the same pre-mock readiness condition **only in this synthetic invoice test**; preserve all UI, Supabase/Auth/RLS, financial accounting and live record behavior. Require Quality 123/123, Security and all three disposable DB on exact repair SHA; then controlled protected merge and same-main checks. Rollback is a test-only revert. All owner-ISP and real invoice E2E remain NOT VERIFIED.

### 2026-10-16 — Master Phase 1A preflight, owner conditional approval (STOP)
- Owner authorizes **only phase 1A preflight / later test-branch & isolated Supabase CLI work**; Phase 1B waits for a separate approval; NO Production DDL/DML (`hcsixhqbyuhpshfwqpjx`).
- Main baseline `bccd474433b4188e43aae345773498ea6fc65209`. Read-only catalog vs repo migration manifest: 82 live versions vs 81 tracked; **25 live-only and 24 repo-only exact identifiers**; `phone_identity_profile` is production-only, and `profiles.phone` exists live. Full Supabase CLI rebuild/schema equality NOT VERIFIED.
- Source + live `finora_sync_records` expose full JSONB writes for eligible users; journal `status/number/postedAt` originate in browser, triggers only guard UPDATE/DELETE of already posted records. Runtime bypass test NOT RUN in production.
- Preflight evidence: `docs/FINORA_PHASE1A_READONLY_PREFLIGHT_2026-10-16.md` + complete `docs/FINORA_PHASE1A_MIGRATION_VERSION_DIFF_2026-10-16.md` on isolated branch `plan/financial-core-phase1-approval-20261016`.
- **GATE:** material schema-history drift; stop before migration or code/test rollout; report conditions 3/4 to owner and await explicit authorization to reconcile/test. No Phase 1A/1B completion claimed.


### 2026-10-16 — Phase 1A CLI schema reconciliation and passing isolated regression (no Production writes)
- Following owner approval, work isolated to branch `feature/finora-phase1a-supabase-cli-20261016`; no Production DDL/DML, no 1B, no migration-history repair or rename of applied migrations. Read-only Production catalog/aggregates captured as hash-only fixtures.
- 1069 schema object fingerprints matched in baseline rebuilt by **full Supabase CLI** after idempotent missing phone/profile bridge; all 154 function definitions matched by token-aware comparison (SQL literals retained). Initial differences were 29 whitespace-only candidates and one additional legacy SQL comment group; all cleared at lexical gate without touching prior migration files.
- Genuine isolated GitHub Actions result **38889304877 SUCCESS**, see `docs/FINORA_PHASE1A_CLI_QA_CHECKPOINT_2026-10-16.md`. Red-before-fix 11 failed; after 1A test migrations 11 passed. CAS, cross-tenant, 1000 postings+1000 compensating reversals, indexed 10000-voucher benchmark, JS syntax all PASS.
- **Still not a releasable Phase 1A**: `js/journal-engine.js` authentic user-created draft carries protected `status`/`number`; protected `postedAt` mutation via client sync also remains, likely blocking actual journal UX. Need a dedicated server-side allowed transition path and non-Production browser E2E. Full migration up/down/up with preserved data, direct PostgREST authorization, Security Definer grant audit, concurrency and multi-user UX remain unverified.
- Stop any production-facing release or merge until blocked items resolve; owner separately approves 1B later.

### 2026-10-16 — Owner authorizes staged Phase 1A implementation, Stage 1 ONLY
- Stage 1: server SQL only (five lifecycle RPCs + atomic source-post, tenant/year counter, computed reversal status, append-only basic audit, org guard off/audit/enforce), tests and CI preflight; STOP and report before Stage 2.
- Stage 2 requires a new owner go-ahead: async strangler for manual journal UI with real Playwright; STOP before Stage 3.
- Stage 3 requires another owner go-ahead: sale, purchase, receipt/payment and subsequent source integrations with browser gate per path.
- No DDL/DML Production, no merge to main, no Phase 1B. No enforce activation without separately approved backup and browser acceptance. Posted originals immutable; reversal references original only, computed reversal status in view. Any necessary posted-original trigger exception must STOP for approval.
- Existing risks to retain: client-editable fiscal year lock; operational inventory records with status/postedAt outside journal guard. Existing Phase 1A test CI at branch head before this request was RED for positive client journal flow; expected until Stage 2, never mark as green.
