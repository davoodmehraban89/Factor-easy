# فینورا — تطبیق اجرایی وضعیت مالی، یکم آذر ۱۴۰۵

**مأموریت:** FIN-AUDIT-20261122 (مرحله اجرایی A، بدون تغییر محصول)  
**مسئول تهیه:** عامل تطبیق مستندات و شواهد؛ **مدیر یکپارچه‌سازی و بازبین نهایی:** Codex اصلی مالک  
**تصمیم:** حفظ کار مفید و تحویل یک گزارش قابل بررسی، نه پیاده‌سازی هم‌زمان چرخه سند.

## ۱. مبنا و تمایز شاخه‌ها

| مرجع | SHA دقیق | نتیجه |
|---|---|---|
| `main` محافظت‌شده | `dab1a45fcfc4f12e675cfe055e477138cd3e99fa` | PR202 منتشرشده، بدون ادغام شاخه مالی؛ [Commit](https://github.com/davoodmehraban89/Factor-easy/commit/dab1a45fcfc4f12e675cfe055e477138cd3e99fa) |
| [PR218](https://github.com/davoodmehraban89/Factor-easy/pull/218) | `bcd8d4eebd4f6852ecf8090670741d81dbc27332` | Draft، مبنای مالی پیشنهادی بر پایه PR212؛ Quality تاریخی روی همین SHA شکست داشت، سایر سه workflow موفق بودند |
| [PR220](https://github.com/davoodmehraban89/Factor-easy/pull/220) | `cabc7aaf1906ce63a9fef5902312fbbc81246e37` | Draft مستنداتی؛ **مبنای این مأموریت مستنداتی**، نه جایگزین PR218 |
| [PR232](https://github.com/davoodmehraban89/Factor-easy/pull/232) | `7eca5d61337c905b0170400ff48e8eaba20afeb3` | Draft؛ نمایش امن اسناد موقت مرتبط و کنترل تناقض لینک |
| [PR233](https://github.com/davoodmehraban89/Factor-easy/pull/233) | `3caaa2d843eafc9db25872114cd3730e41a4a3d3` | Draft QA؛ چهار گردش‌کار روی همین HEAD موفق؛ دیگر «WP1 در انتظار» نیست |
| [PR234](https://github.com/davoodmehraban89/Factor-easy/pull/234) | `c113cba8c3e4476edb1566b9c64559d5fb6be9fd` | Draft روی PR232؛ QA PR233 و UI PR232 بدون تکرار XFAIL قدیمی تلفیق شده‌اند؛ **آخرین کاندیدای QA/UI بررسی‌شده** |

**دقت:** انتخاب PR218 به‌عنوان «مبنای مالی» به معنای تغییر شاخه هدف PR234 نیست. PR234 صرفاً ترکیب آزمایشی QA/UI است و کد SQL/RPC مشکل‌دار را حل نمی‌کند. PR221 و شاخه‌های بعدی برخی خرابی‌های CI پایه PR218 را برطرف کردند؛ موفقیت CI آن‌ها را به SHA قدیمی PR218 نسبت ندهید.

آخرین استقرار موفق Pages **در گزارش ممیزی PR220** [run 43606173842](https://github.com/davoodmehraban89/Factor-easy/actions/runs/43606173842) ثبت شده است. در این نوبت استقرار جدید یا readback از سایت عملیاتی تأیید نشده؛ عبارت «آخرین استقرار موفق امروز» مجاز نیست.

## ۲. گیت‌های واقعی PR234 روی SHA دقیق

| گیت | اجرای قابل مشاهده | نتیجه و حدود |
|---|---|---|
| Quality | [45043152359](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45043152359) | SUCCESS؛ در لاگ `static-quality`، **۲۵۸ Chromium PASS + چهار Pages PASS**؛ سه Expected-RED شناخته‌شده و sentinel اجرا شدند |
| WP1 | [45043152268](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45043152268) | SUCCESS؛ هر دو job؛ شواهد SQL منفی، ۱۰۰۰ رویداد و local stack، نه Production |
| WP2 | [45043152377](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45043152377) | SUCCESS؛ آزمون واقعی Auth JWT روی Supabase disposable؛ **دو نشانگر P0 در لاگ به معنای تداوم نقص هستند** |
| Security | [45043152325](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45043152325) | SUCCESS برای Release safety و CodeQL؛ job `Dependency review` **SKIPPED** است، نه passed |

شواهد مستقیم از لاگ WP2:
- `WP2_POSITIVE_AUTHORIZED_JOURNAL_PASS`: چرخه دستی `create/replay/post/readback` با JWT معتبر روی محیط آزمایشی.
- `FINORA_ISSUE229_APPROVAL_EXPECTED_RED`: فروش با JWT فروشندهٔ غیرمالک که `commerce:create` دارد اما `accounting:approve` ندارد، توسط مسیر autoPOST **واقعاً POSTED** شده است.
- `FINORA_ISSUE229_PURCHASE_APPROVAL_EXPECTED_RED`: خرید اعتباری با همان فقدان مجوز accounting:approve **واقعاً POSTED** شده است.
- مرورگر: **سه سناریوی known product expected RED**: ذخیرهٔ خرید، ذخیرهٔ فروش رسمی بدون دفترکل موقت متصل، ذخیرهٔ اصلاحیهٔ خرید پس از سند قطعی. تست `assertKnownRedOrFixed` وضعیت مالی سوم و ناشناخته را رد می‌کند؛ XFAILهای مورد انتظار «اصلاح محصول» محسوب نمی‌شوند.

## ۳. ماتریس تطبیق پیش از تغییر

| موضوع | پیاده‌سازی موجود | شاهد آزمون | منتشرشده؟ | نقص باقی‌مانده | اقدام |
|---|---|---|---|---|---|
| RPC سند دستی و CAS | PR206/207/212/218 و وابستگی‌ها | WP1/WP2 و آزمون adapter | خیر | پذیرش کامل در محصول زنده انجام نشده | **حفظ؛ بدون بازنویسی**؛ سنجش روی SHA منتخب |
| اتصال منبع به سند **قطعی‌شده** | migration مؤثر `20261117110000_wp1_autopost_source_link_atomic.sql` | WP2 فروش و خرید و rollback آزمایشی | خیر | صرفاً پس از ذخیرهٔ منبع، خودکار قطعی می‌شود | **حفظ؛ بدون بازنویسی**؛ گردش source+linked DRAFT جدا طراحی شود |
| status و کنترل UI سند موقت مرتبط | PR232، منتقل‌شده به PR234 | Chromium normal PASS | خیر | اصلاح UI به تنهایی ثبت سروری DRAFT را ایجاد نمی‌کند | **حفظ؛ بدون بازنویسی** |
| حفاظت ویرایش‌های معوق | کار فعال اصلی / شاخه‌های قبلی | شواهد تاریخی، نه پذیرش PR234 | خیر | تطبیق نهایی و پذیرش مرورگری/سازمانی مستقل | مالک Codex اصلی؛ هیچ تغییر موازی در sync.js/organization-rbac.js/journal-ui.js |
| ذخیرهٔ موقت منبع + دفترکل، بدون قطعی‌سازی | مسیر فعلی source save/autoPOST؛ قرارداد در ADR216 | سه known RED مرورگر | خیر | نبود تراکنش صحیح DRAFT + لینک و نسخه/حساب‌ها | P0؛ پیاده‌سازی **یک مسیر** توسط Codex اصلی |
| مجوز جداگانهٔ `accounting:approve` | RPC فعلی autoPOST | دو نشانگر واقعی WP2/JWT | خیر | فروشنده فاقد اجازه تأیید می‌تواند POST کند | P0 مانع انتشار؛ کنترل سرور و آزمون رد/قبول با دو نقش |
| عطف تغییرناپذیر، موقت و قطعی جدا | ADR216 + `supabase/candidates/0216_attachment_registry.sql` | آزمون allocator و concurrency مستقل | خیر | کاندیدا به CRUD کامل محصول متصل نیست | حفظ کاندیدا؛ طراحی و آزمون atomic/tombstone روی DB disposable |
| حذف منبع و حسابرسی | طرح ADR216 و گاردهای جزئی | آزمون‌های جزئی | خیر | حذف سراسری صحیح، tombstone، نسخه/tenant و rollback | ممنوعیت merge شاخه‌های جایگزین ناسازگار |
| چک، گزارش draft-only/posted-only و همه منابع | قرارداد و بخشی از کد قبلی | شاهد کامل End-to-End وجود ندارد | برخی بخش‌های قدیمی | پوشش کامل و عدم دوباره‌شماری ثابت نشده | backlog کنترل‌شده؛ پس از P0 اصلی |
| اسناد قبلی | preflight و تصمیم مالک | گزارش تطبیق قبلی | تبدیل نشده | dry-run executor، زنجیره اصلاح و تطبیق مبلغ/شرکت | بدون بازنویسی posted، پیش‌آزمون تراکنشی و گزارش exception |

**ریسک PRهای جایگزین:** PR214/215/217/219 حاوی تضادهای شناخته‌شده در migration و scope/permission/NULL version و تاریخچهٔ posted هستند؛ merge گروهی ممنوع. رجیستری candidate در PR218 نیز هنوز مجوز اجرای Production نیست.

## ۴. اقدام غیرهم‌پوشان و مالکیت

- **این مأموریت**: تنها ثبت تطبیق CI/PR، مستندات وضعیت و roadmap؛ فایل‌های `PROJECT_STATE.md`، `docs/EXECUTION_STATUS.md`، `docs/ACCOUNTING_CORE_ROADMAP_V1.md` و همین گزارش. مبنای شاخه PR220 است. هیچ کد برنامه، SQL، workflow، محیط تست/عملیات، migration یا دادهٔ مشتری تغییر نمی‌کند.
- **Codex اصلی مالک**: تنها مسئول نهایی تغییر RPC/RBAC/SQL، انتخاب مبنای یکپارچه‌سازی، بازبینی مستقل/merge/release. PR234 یک کاندیدای QA/UI باقی می‌ماند.
- **QA مستقل**: پس از پیاده‌سازی سرور، کنترل اجرای موفق `save source+linked draft`، رد `Finalize` برای فروشنده، تأیید مجاز با نقش approve، retry با شناسهٔ پایدار، concurrency، rollback، tombstone و عدم نوشتن تاریخچهٔ posted. حذف کردن known RED بدون تبدیل به PASS واقعی ممنوع است.

## ۵. تطبیق مراحل اجرایی A–F با فازهای مصوب

**A–F دستورالعمل اجرایی این مأموریت‌اند، نه نام‌گذاری مجدد فازهای محصول.** برای گزارش مدیریتی شش‌فازی مصوب (فاز ۰ تا ۵) درصدهای **تخمینی سابق و تغییرنیافته** حفظ شده‌اند:

| مرحلهٔ اجرایی مأموریت | فاز مرتبط محصول (۶ فاز) | پیشرفت مدیریتی قبلی | پذیرش واقعی در این نوبت |
|---|---|---:|---|
| A تثبیت مبنا و مالکیت | فاز ۰ ممیزی و معماری | ۹۰٪ | تطبیق read-only و سند؛ پذیرش Codex اصلی لازم |
| B حفظ داده و شکست CI | فازهای ۱/۴ | ۵۰٪ هسته سرور | CI PR234 موفق؛ اصلاح مستقل سرور هنوز P0 |
| C چرخه سند موقت | فاز ۲ | ۲۰٪ | ۳ expected RED؛ بدون ارتقای درصد |
| D شماره‌گذاری و حذف | فاز ۳ | ۵۵٪ سلامت دفتر | کاندیدای allocator آزمایشی؛ نه آماده انتشار |
| E منابع مالی و گزارش‌ها | فاز ۴ | ۵۳٪ رابط | PR232/234 QA/UI موفق؛ عدم پوشش مالی کامل |
| F تاریخچه و انتشار | فاز ۵ | ۱۰٪ | بدون merge/deploy/تبدیل تاریخی |

درصدها **شاخص اندازه‌گیری مهندسی نیستند**. تا پذیرش شروط، افزایش از روی تعداد تست یا اسناد مجاز نیست.

## ۶. ریسک و خروجی دقیق بعدی

**مانع فعلی P0:** فقدان قطعی‌سازی مستقل با کنترل سروری `accounting:approve` و ناتمام بودن source+linked draft-first در فروش و خرید. رفع آن از مسیر legacy autoPOST با تغییر نام دکمه یا افزودن بررسی UI ممکن نیست.

**گام بعدی Codex اصلی (نه این شاخه):**
1. تثبیت SHA شاخه یکپارچه‌سازی و بررسی `docs/adr/0216-draft-first-document-identity.md` و Issue216/229؛ PR234 را به‌عنوان ادله QA/UI حفظ کند.
2. **پیش از SQL**، قرارداد RPC واحد برای persisted source + linked draft و دستور Finalize جدا با `accounting:approve`، version/CAS، tenant/company/fiscal و idempotency را در ADR ثبت کند؛ مدیریت کد مالی صرفاً با مالک اصلی.
3. فقط پس از مجوز لازم، migration محدود + rollback را روی Supabase **مستقل disposable** اجرا کند؛ دو تست حقیقی JWT برای فروشندهٔ ممنوع و تأییدکنندهٔ مجاز و atomic rollback را اضافه کند؛ آزمون تاریخی fingerprint و ledger را کنترل کند.
4. تبدیل XFAILهای PR234 به PASS حقیقی، اجرای Quality/WP1/WP2/Security روی SHA نهایی، بازبینی مستقل؛ سپس تصمیم جداگانهٔ merge/release.

**نقطهٔ ادامهٔ قابل تکرار:** `scripts/accounting-document-workflow.spec.js` (سه expected RED در PR234)، `scripts/wp2-source-approval-boundary-jwt-e2e.mjs` (دو JWT P0 در PR231/234)، `supabase/migrations/20261117110000_wp1_autopost_source_link_atomic.sql` (autopost مؤثر)، `docs/adr/0216-draft-first-document-identity.md` (قرارداد). اجرای بعدی باید دقیقاً پس از انتخاب SHA مورد قبول Codex اصلی آغاز شود.

## ۷. حدود این گزارش

- این نوبت **بازبینی مستقل کامل کد مالی** یا مرورگر متصل به Production انجام نداده است؛ GitHub metadata/diff، متن ADR، و لاگ CI دقیق خوانده شده‌اند.
- هیچ آزمون جدید محلی محصول اجرا نشده؛ شواهد آزمون از گردش‌کارهای واقعی و مشخص‌شدهٔ GitHub است.
- هیچ محیط عملیاتی، DB، Auth یا تاریخچه‌ای تغییر نکرده؛ تنها branch/PR مستنداتی کاندیدای پذیرش است.
- تصمیم قبلی مالک دربارهٔ عدم الزام به اتصال بکاپ برای تبدیل گروهی **حفظ شده** و درخواست مجدد ایجاد نشده است؛ این تصمیم به معنی مجوز تخریب تاریخچه نیست.


## ۸. الحاقیهٔ ۲۳ نوامبر ۲۰۲۶ — FIN-A-20261123 / تطبیق PR240 و علت CI PR218

> این الحاقیه تاریخچهٔ FIN-AUDIT-20261122 و PR235 را **تصحیح/تکمیل** می‌کند؛ آن را با وضعیت «منتشرشده» اشتباه نگیرید. مرجع هماهنگی و ادغام کد مالی همچنان Codex اصلی مالک است. اطلاعات این بند از GitHub PR/Issue/Actions در ۲۰۲۶-۱۱-۲۳ بررسی شده؛ خواندن Production DB، تست حساب واقعی یا استقرار انجام نشده است.

### ۸.۱. مبنا، وابستگی‌ها و انتشار

| مرجع | SHA دقیق | وضعیت و مالکیت |
|---|---|---|
| [main](https://github.com/davoodmehraban89/Factor-easy/commit/dab1a45fcfc4f12e675cfe055e477138cd3e99fa) | `dab1a45fcfc4f12e675cfe055e477138cd3e99fa` | همان merge PR202 در ۱۴ نوامبر؛ هیچ کد مالی از این شاخه‌های Draft منتشر نشده |
| [PR218](https://github.com/davoodmehraban89/Factor-easy/pull/218) | `bcd8d4eebd4f6852ecf8090670741d81dbc27332` | Draft، **مبنای پیشنهادی** مالی، تغییر نمی‌کند؛ stacked on PR212 |
| [PR221](https://github.com/davoodmehraban89/Factor-easy/pull/221) | `44b697b4c75f5d4ae46c2229cbe5bac5972d7151` | کاندیدای اصلاح مستقل بخشی از Kardex/QA روی PR218، Draft؛ شواهد CI این SHA نه PR218 |
| [PR235](https://github.com/davoodmehraban89/Factor-easy/pull/235) | `1b1057846b65d73a6dca8cf61ec100ef766c065b` | والد این الحاقیهٔ مستنداتی؛ خودش روی PR220 است و اجرای مالی محسوب نمی‌شود |
| [PR240](https://github.com/davoodmehraban89/Factor-easy/pull/240) | `790772b98668c052152846bf3481d21659273acf` | Draft زنجیرهٔ QA روی PR239/237؛ صرفاً یک فایل Playwright و دو سند در خود PR240 تغییر کرده‌اند؛ هیچ اصلاح منطق انبار در آن وجود ندارد |

آخرین Pages موفق **تأییدشده در گزارش قبلی** [43606173842](https://github.com/davoodmehraban89/Factor-easy/actions/runs/43606173842) است؛ اجرای موفق جدید/انتشار امروز **تأیید نشده**. اجرای `skipped` از workflowهای Pages/Release در ۲۳ نوامبر انتشار جدید نیست.

### ۸.۲. تشخیص شکست واقعی مبنای مالی

| SHA / workflow | واقعیت بررسی‌شده | حکم |
|---|---|---|
| PR218 `bcd8d4ee...`، [Quality 44687469576](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44687469576) | Job `static-quality` در مرحلهٔ `Real DOM smoke` FAILED: **۲۳۶ PASS، ۱۳ FAIL** مرورگر؛ ازجمله `scripts/phase0-invoice-persistence.spec.js` و `scripts/ux-hardening-r2.spec.js` در انتظار/لود/هیدراسیون UI. سه Job DB دیگر SUCCESS. | شکست تاریخی واقعی؛ شواهد برای انتساب همهٔ ۱۳ شکست به یک علت ریشه‌ای کافی نیست |
| PR221 `44b697b4...`، [Quality 44978932775](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44978932775) | SUCCESS روی **SHA متفاوت و شاخهٔ فرزند**؛ [WP1 44978932846](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44978932846) و [Security 44978932790](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44978932790) نیز SUCCESS؛ در این SHA، WP2 جداگانه trigger نشده است. | اصلاح/تکمیل کاندیدای بعدی را حفظ کن؛ CI موفق آن «اصلاح مستقیم SHA قدیمی PR218» نیست |
| PR240 `790772b9...`، [Quality 45120904319](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45120904319) | SUCCESS، **۲۶۸ Chromium PASS و ۴ Pages PASS**؛ تعدادی known-product-RED با fingerprint دقیق عمدی اجرا شدند | **پذیرفته‌شده در QA برای بازتولید**، نه محصول صحیح یا منتشرشده |

برای CI PR240 روی SHA نهایی آن: [WP1 45120904352](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45120904352) SUCCESS، [WP2 45120904308](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45120904308) SUCCESS و [Security 45120904337](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45120904337) SUCCESS. `Dependency Review` اختیاری SKIPPED و بنابراین **قبول‌شده** گزارش نمی‌شود. WP2 واقعی Auth/JWT هنوز دو نشانگر `FINORA_ISSUE229_APPROVAL_EXPECTED_RED` و `FINORA_ISSUE229_PURCHASE_APPROVAL_EXPECTED_RED` را بازتولید می‌کند؛ **مجوز `accounting:approve` به‌درستی اعمال نشده**. WP2 PR240، اثبات real-JWT نفوذ انبار/شرکت نیست.

### ۸.۳. جدول تطبیق افزوده‌شده پس از PR240 (Stage A)

| موضوع | پیاده‌سازی موجود | شاهد آزمون | منتشرشده؟ | نقص باقی‌مانده | اقدام لازم |
|---|---|---|---|---|---|
| هستهٔ RPC دستی، CAS، لینکِ منبع **قبلاً persistشده** به سند **POSTED** | PR206/207/212/218 و migration مؤثر `20261117110000_wp1_autopost_source_link_atomic.sql` | PR228 WP2 مثبت؛ PR240 WP1/WP2 روی شاخهٔ QA | خیر | Save اولیهٔ منبع و journal DRAFT هنوز یک تراکنش نیست؛ autoPOST مجوز مستقل ندارد | **حفظ؛ بدون بازنویسی**، افزودن گذار DRAFT مستقل فقط با مالک هسته |
| نمایش linked-draft خرید/فروش | PR232/234 | مرورگر PR234 و سناریوهای PR240 | خیر | UI کافی نیست و ایجاد source+draft سروری را تضمین نمی‌کند | **حفظ؛ بدون بازنویسی** |
| موجودی خرید draft بدون رسید قطعی | `p5OperationalEvents/p5AverageCost` در PR240 | [PR240](https://github.com/davoodmehraban89/Factor-easy/pull/240) Chromium؛ posted ۲ واحد بهای ۵۰ + draft ۳ واحد بهای ۱۰۰؛ Phase5 **۵ واحد و بهای ۸۰**، Kardex **۲ واحد و بهای ۵۰** | خیر | اثرگذاری سند غیرقطعی بر مانده/میانگین، بدون receipt مستقل | Codex اصلی: سیاست شناخت فیزیکی/بهای تمام‌شده + read model واحد |
| انبار دوم | مسیر `p5OperationalEvents` | Chromium PR240؛ خرید قطعی ۳ واحد در W2؛ موجودی نمایش‌داده‌شده W2 **صفر** | خیر | رویداد خرید انبار غیرپیش‌فرض وارد محاسبه نمی‌شود | Codex اصلی: scope انبار و شناسایی رویداد؛ ابتدا آزمون پایه را حفظ کند |
| شرکت دومِ همان مالک | خرید قطعی شرکت B بدون `warehouseId` در fixture؛ محاسبه Phase5 | Chromium PR240؛ شرکت A **۶ واحد/۱۵۰** به جای **۲ واحد/۵۰** | خیر | فیلتر شرکت و سیاست metadata قدیمی ناسازگار است | Codex اصلی: فیلتر company+org+warehouse در مدل سرور/کلاینت؛ این **اثبات RLS breach نیست** |
| شمارش انبار و حسابداری اثر آن | `p5SaveCount` | Chromium PR240؛ موجودی ۲→۵ و valuation ۷۵، source+voucher بلافاصله POSTED | خیر | ذخیره باید DRAFT بماند و اثر stock/ledger تا Finalize مجاز کنترل شود | Codex اصلی؛ قرارداد source-linked draft و atomic finalize |
| سند فروش/خرید، دریافت/پرداخت، هزینه/درآمد | مسیرهای autoPOST موجود؛ Issue229/238 | PR234/239/240 مرورگر known RED و WP2 دو JWT approval RED | خیر | Save/approval تفکیک نشده؛ جزئیات producer در #238 | Codex اصلی؛ اجرای یک الگوی واحد، نه موتور دوم |
| Kardex گردش دستی و sign/شرکت | Issue223؛ اصلاح محدود خرید/فروش در PR221 | بررسی کدِ Issue223؛ **آزمون مستقل مرورگری گردش دستی هنوز تأیید نشده** | خیر | اثر draft، adjustment_out و انتقال بین انبارها | پس از رفع P0 حسابداری، سناریوهای اختصاصی Issue223 در QA مستقل |

### ۸.۴. مالکیت، ترتیب و شروط خروج

- **این شاخهٔ مستنداتی:** تکمیل Stage A و تشخیص تاریخی CI؛ تنها `PROJECT_STATE.md`، `docs/EXECUTION_STATUS.md`، `docs/ACCOUNTING_CORE_ROADMAP_V1.md` و همین سند. هیچ اصلاح مالی، JS، SQL، migraton، test، workflow، DB/Auth/tenant یا Production صورت نگرفته.
- **Codex-main:** نگه‌داری PR218 به‌عنوان کاندیدای مالی تا تصمیم مستقل؛ انتخاب SHA یکپارچه‌سازی؛ اصلاح واحد خواندن موجودی برای شرکت/انبار/وضعیت مؤثر و رسید فیزیکی، به همراه server DRAFT Save و Finalize مستقل `accounting:approve`. بدون مجوز مالک، تغییر معماری/SQL نکن.
- **QA مستقل:** ابتدا محصول اصلاح‌شده را روی baseline منتخب بازتولید و سپس نشانگرهای `FINORA_ISSUE238_OTHER_WAREHOUSE_EXPECTED_RED`، `FINORA_ISSUE238_CROSS_COMPANY_STOCK_EXPECTED_RED`، `FINORA_ISSUE238_DRAFT_PURCHASE_STOCK_EXPECTED_RED`، `FINORA_ISSUE238_INVENTORY_COUNT_EXPECTED_RED` و Issue229 approval را به PASS واقعی تبدیل کند؛ real JWT شرکت/انبار، concurrent finalize، replay و rollback ضروری است.
- **ترتیب تصمیم وابسته:** ابتدا تعریف دامنهٔ `company/org/warehouse` و سیاست سند انبار/رسید/بهای تمام‌شده و بازبینی قرارداد ADR216، سپس کوچک‌ترین تغییر سروری/عملیاتی، سپس QA روی SHA نهایی و بازبینی مستقل. ثبت موقت در UI یا عبور از ۲۶۸ تست **معیار خروج C/E نیست**.
- **بستهٔ تاریخچه:** posted قدیمی را downgrade نکن؛ PR217/219 با migration بازنویسی‌کنندهٔ posted مجاز به merge جمعی نیستند. تصمیم مالک درباره عدم الزام اتصال بکاپ برای تبدیل گروهی محفوظ است؛ هنوز هیچ داده‌ای تبدیل یا dry-run executor تأیید نشده.
- **شاخص‌های مدیریتی قبلی:** A90/B50/C20/D55/E53/F10 بدون تغییر؛ درصد مهندسی قابل‌استنتاج از PR240 نیست.

**نقطهٔ ادامه پس از Stage A:** `js/phase5-enterprise.js::p5OperationalEvents / p5AverageCost / p5Stock` و `scripts/accounting-document-workflow.spec.js` در PR240 برای دو سناریوی W2/company، `js/products.js::productKardexRows` برای Issue223، `scripts/wp2-source-approval-boundary-jwt-e2e.mjs` برای نقش‌ها و `supabase/migrations/20261117110000_wp1_autopost_source_link_atomic.sql` برای حفظ مسیر atomic فعلی. نخستین آزمون پس از اصلاح: **همان شرکت A، دو انبار، خرید قطعی W2=۳، خرید B بدون warehouseId و خرید draft شرکت A**؛ مانده و بهای شرکت A و W2 باید مستقل و با سند/رسید مؤثر تطبیق داشته باشد. سپس فروشندهٔ فاقد `accounting:approve` در Supabase آزمایشی فقط DRAFT ذخیره کند و Finalize او رد شود.
