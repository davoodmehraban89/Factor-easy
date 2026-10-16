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
- Supabase Production با ref `hcsixhqbyuhpshfwqpjx` شناخته می‌شود؛ تاریخچه پیشین حدود ۸۲ migration تا ۱۴۰۵/۰۷/۲۱، drift آرشیو `phone_identity_profile` و warningهای امنیتی ثبت شده‌اند. **در این ممیزی هیچ بازبینی زنده جدید دیتابیس انجام نشده است.** بدون preflight ادعای وضعیت زنده امروز نکن.

## ۴. فاز صفر جدید پرامپت مالی — خروجی/مرز
- **مالک کار:** هماهنگی + ممیزی مالی/کیفیت. **ورودی:** SHA ثابت بالا، JS مالی، SQL migration، workflow و فایل پرامپت کاربر.
- **خروجی:** `docs/EVENT_COVERAGE.md` (جدول رویدادها، سند خودکار/مشروط/مفقود و همه مسیرهای دستی)، `docs/TEST_AUDIT_PHASE0.md` (۳۸ مجموعه Playwright + ۳۵ چک ایستا/regex + ۱۴ رفتاری/ترکیبی + ۵ ابزار)، `docs/PHASE0_FINANCIAL_AUDIT_2026-10-16.md` (گزارش یک‌صفحه‌ای، P0/P1 و مرز تست) و آرشیو کامل تاریخچه.
- **یافته فنی:** موتور اصلی `jeCreateDraft/jePost/jeAutoPost` مرورگری است؛ `finora_sync_records` رکورد JSONB را upsert می‌کند؛ guardهای posted روی UPDATE/DELETE هستند و INSERT زیر سند posted فاقد حفاظت هم‌ارز است؛ `jeNextNumber` سمت مرورگر اجرا می‌شود. عدم تعادل/هم‌زمانی و source-idempotency سراسری هنوز بر سرور با تست‌های منفی فاز ۱ تأیید نشده است.
- **خطرات دیگر:** چک مستقل، COGS، FX، closing/opening، VAT settlement و بخشی از چرخه برگشتی سند خودکار ندارند؛ `js/sync.js:139–143` رشته‌ها را با `neutralize` دگرگون می‌کند. در فاز ۰ هیچ مورد اصلاح عملیاتی نشده است.
- **تست موجود baseline:** `123/123` Chromium + Golden + ۳ DB و Security PASS (با شماره اجرا در بالا)؛ تست واقعی ۱۰۰۰ رویداد تصادفی، concurrency مالی و production E2E را **NOT VERIFIED** ثبت کن. تست‌ها از source/CI بررسی شده‌اند؛ clone به محیط محلی این چت به دلیل DNS ممکن نبود.
- **تغییرات این فاز:** فقط چهار سند audit/archive و همین خلاصه؛ **هیچ کد JS، اسکیما، Production SQL، نقش یا داده مالی تغییر نکند.** برای تکمیل، PR scoped باید Quality/Security موفق و یکپارچگی آرشیو تأیید شود.

## ۵. تعهدها/کارهای معوق (در فاز صفر انجام نشد)
- فاز ۱ جدید تنها پس از دستور صریح مالک + دسترسی به Postgres آزمایشی مستقل و preflight/rollback: deferred balance+min lines، guard درج، optimistic version، شماره سند تراکنشی، قفل دوره، ممیزی append-only، event RPC/idempotency و گزارش read-only ناسازگاری تاریخی.
- Issue #106 ورود روی اینترنت مالک، آزمون واقعی تسویه/چاپ، QA دوکاربره tenant، رفع drift مایگریشن، Leaked Password Protection و بکاپ رمزنگاری‌شده Production + کپی بیرونی + بازیابی آزمایشی همچنان **OPEN / NOT VERIFIED**. بدون مجوز در این موارد کاری نکن.
- مدارک مرجع دیگر: `docs/FINORA_OFFLINE_BACKUP_FA.md`، `docs/FINORA_PHASE0_ACCEPTANCE_REGISTER_2026-10-12.md`، `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` و آرشیو کامل بالا.

## ۶. ثبت پایان این نوبت
- درخواست مالک در ۱۴۰۵/۰۷/۲۴: «پرامپت را کامل مبنا بگیر؛ **فقط فاز ۰** را اجرا کن و بعد از پایان گزارش خلاصه بده؛ ادامه فاز ۱ با دستور جداگانه».
- شروع از `main` SHA بالا، ایجاد شاخه `audit/finora-master-prompt-phase0-20261016`، آرشیو کامل و گزارش‌ها تولید شد. **وضعیت QA این شاخه باید از GitHub PR-head جدا بررسی شود**؛ تایید نهایی فاز فقط با قبولی آن و ادغام مستندات معتبر است.
