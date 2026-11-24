# FIN-V2 M01 — ماتریس ردیابی درخواست مالک (checkpoint اولیه)
تاریخ 2026-11-24 · Issue [#258](https://github.com/davoodmehraban89/Factor-easy/issues/258) · منشور V2: `85438788324ff507eb7305a78dca214fd118b752` · مبنا PR253: `98cb670f6d9f03900ce644efdf43df36127e30f8`. مسئول: QA/مستندسازی مستقل؛ Codex-main بازبین و مدیر یکپارچه‌سازی. بسته به PR257 وابسته نیست. دامنه فقط سند حاضر است.

## شواهد و محدودیت
- مبنای نقشه راه: `docs/FINORA_EIGHT_PHASE_APPROVED_ROADMAP_2026-10-11.md`، `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md`، `docs/EVENT_COVERAGE.md` (ممیزی تاریخی، نه شاهد کد فعلی) و منشور V2. نگاشت A–J نقشه راه جایگزین نقشه مصوب نیست.
- شاهد K: Quality [45352284249](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45352284249) در SHA مبنا SUCCESS؛ صرفاً اجرای کلی، نه نتیجه مستقل هر ردیف. شاهد W: WP1 [45352284056](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45352284056)، WP2 [45352284208](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45352284208) SUCCESS؛ دامنه کاندیدا، آزمون‌های expected RED ممکن است نقص باز را ثبت کنند. Security [45352284210](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45352284210) SUCCESS. هیچ نتیجه ای به SHA بعدی تعمیم داده نمی‌شود.
- مسیرهای کاندیدا بر پایه tree و فایل‌های آزمون خوانده‌شده در SHA ثابت هستند؛ اثبات کامل مسیر API/SQL یا پوشش تمام درخواست‌های ۲۶۰ فصل هنوز انجام نشده. وضعیت انتشار تمام تغییرات کاندیدا: **منتشرنشده/ادغام‌نشده**. main در dab1a45 است؛ قابلیت‌های پیشین روی main را از نو ناقص یا منتشرشده اعلام نمی‌کنیم.

| درخواست مالک / قابلیت | فاز مصوب / بسته | مسیر UI یا کد کاندیدا | آزمون / شاهد | گپ و وضعیت پذیرش |
|---|---|---|---|---|
| ورود و بازیابی رمز، خطای شبکه قابل فهم | 0/1 B,I | login-connectivity.js, bootstrap.js, password-recovery.js | login-connectivity.spec.js; login-auth-transport.spec.js; password-recovery.spec.js / K | مرورگر mock و transport SDK؛ شبکه واقعی مالک و حساب واقعی باز |
| تعویض سازمان بدون فقدان ویرایش | 0/1 B | organization-rbac.js, sync.js | pending-sync-preservation.test.mjs / K؛ B01/B02 | B02 سبز؛ B03/PR254 Quality ناموفق، PR257 باز؛ بازیابی واقعی نیازمند قبول |
| انتخاب و تفکیک شرکت قانونی | 1/2 B,E | companies.js, organization-rbac.js | accounting-document-workflow.spec.js: registers isolate companies; phase0-invoice-persistence.spec.js / K | مرورگر کنترل‌شده؛ دو شرکت با نقش واقعی و عملیات سروری لازم |
| اعضا، دعوت و نقش | 1 B | organization-invitations.js, organization-rbac.js, organization-shell.js | enterprise-invitation.spec.js, enterprise-role.spec.js, workspace-access.spec.js / K | دعوت/نقش/حذف دسترسی UI؛ چرخه مجاز واقعی دو کاربر هنوز اثبات کامل نشده |
| ظرفیت لایسنس، کاربران نام‌دار و ظرفیت شرکت (مستقل از holding) | 1 B | admin.js, organization-enterprise-ux.js | enterprise-license.spec.js: ELI-1 capacity; workspace-access.spec.js / K | DOM، تست مستقل تغییر ظرفیت/مرز سرور لازم؛ گروه شرکتی معادل ظرفیت نیست |
| منوی مجاز و ناوبری، صفحه‌کلید، RTL | 0/4 G | ui.js, organization-shell.js, platform-modules.js, ux-hardening-r2.js | dom-smoke.spec.js Phase A, commerce-route-types.spec.js, ux-keyboard-f2.spec.js / K | تست نمایشی، عدم حذف ماژول؛ ماتریس تمام نقش/منو و تأیید مرجع بصری لازم |
| ثبت سند دستی/ابعاد/تراز و اصلاح بدون پاک‌کردن سابقه | 2 C,D | journal-ui.js, journal-rpc.js, journal-engine.js | accounting-p0-journal.spec.js; accounting-document-workflow.spec.js; WP1 / K,W | شواهد mock و کاندیدای DB؛ real browser + role + lifecycle ترکیبی لازم |
| فروش و خرید؛ هر Save ابتدا linked draft، تأیید مستقل | 2/3 C,D,F | invoices.js, purchases.js, document-management.js, journal-rpc.js | accounting-document-workflow.spec.js #229; wp2-source-approval-boundary-jwt-e2e.mjs / K,W | **expected RED #229**، نه اصلاح؛ C01/D01 design جدا، پیاده‌سازی باز |
| پرداخت/دریافت و تخصیص | 3 D,F | payments.js, journal-rpc.js | accounting-document-workflow.spec.js treasury correction; wp2-source-autopost-jwt-e2e.mjs / K,W | چرخه draft-first و تراکنش/نقش واقعی نیازمند تکمیل #238 |
| چک (صدور/دریافت/وصول/برگشت/خرج/عودت)، منع دوباره‌شماری | 3 F | cheques.js, payments.js | accounting-document-workflow.spec.js: treasury correction excludes cheque / K | فقط شاهد مرز اصلاح؛ آزمون و قرارداد مستقل هر رخداد و مانده لازم |
| مانده طرف حساب/تسویه فقط یک بار، شرکت درست | 3/4 F,G | contacts.js, payments.js, accounting.js | accounting-document-workflow.spec.js: contact operational balance includes effective settlements once; saved unallocated supplier payment / K | UI کنترل‌شده؛ تطبیق GL و سناریوی چک واقعی باز |
| هزینه/درآمد | 3 F | expenses.js, journal-engine.js | سابقه #238 و PR239 expected RED، بیرون از این checkpoint بررسی کامل نشده | Save draft-first و کنترل مجوز مستقل باز |
| انبار/کاردکس/انتقال/شمارش/ارزش‌گذاری | 3 F | phase5-enterprise.js, phase5-domain.js | QA PR240/242/243/244، خارج از پذیرش مبنا؛ بازاستفاده آزمون‌های موجود | #223 #245 #246 باز؛ کاردکس، شرکت/انبار و سند/دفتر نیازمند تطبیق |
| گزارش تفکیکی موقت/قطعی/هر دو و drill-down | 4 G | phase6-reporting.js, accounting.js, drilldown.js, document-management.js | phase0-modal-dashboard.spec.js: dashboard cards drill to accounts and voucher / K | آزمون تفکیک نوع/وضعیت و GL reconciliation کامل نشده |
| شماره عطف دائمی | 2 E | journal-rpc.js; supabase/candidates/0216_attachment_registry.sql | wp1-attachment-two-session-e2e.mjs / W (کاندیدای رجیستری) | رقابت کاندیدا ≠ اتصال تمام اسناد؛ تخصیص/حذف و tombstone باید پذیرفته شود |
| شماره موقت | 2 E | journal-ui.js, journal-rpc.js, document-management.js | accounting-document-workflow.spec.js draft cases / K | شماره‌گذاری مستقل سروری، سازمان/شرکت/سال و retry باز |
| شماره قطعی | 2 E | journal-engine.js, journal-rpc.js | wp2-source-autopost-jwt-e2e.mjs / W | ثبت قطعی موجود آزموده شده؛ عدم بازیافت و تفکیک سه شماره در همه منابع هنوز باز |
| حفظ تاریخچه، تبدیل و تطبیق | 2/5 H | preflight و تاریخچه PROJECT_STATE؛ executor جدا | accounting-history-migration-guard.mjs و .test.mjs / فهرست موجود، نتیجه ردیفی بررسی نشده | صرف‌نظر قبلی بکاپ محفوظ؛ dry-run، تصمیم شرکت، exception queue و audit باید کامل شود؛ هیچ عملیات واقعی |
| مالیات، چاپ، اسناد ایران | 4 G,I | taxpayer-print.js, print.js, invoices.js, purchases.js | taxpayer-print.spec.js / K | چاپ کنترل‌شده؛ قوانین تاریخ‌دار، بازبینی حسابدار و چاپ واقعی باز |
| قرارداد و پروژه | 3/6 F,J | phase4-contracting.js, projects.js | ux-hardening-r2.spec.js: counterparty project manager / K | صورت وضعیت و کسورات نیاز به چرخه سروری کامل و تطبیق |
| اتوماسیون اداری/workflow/OCR/SLA | 6 J (فریز طبق PROJECT_STATE) | office-automation.js, office-workflow.js, request-workflow-d2/d3b/d3c/d4a.js | office-slice-c1–c8, request-workflow tests; K؛ PR254 C8 locator failure | حفظ موجود؛ توسعه دامنه بدون درخواست جدید ممنوع؛ QA C8 در PR257 |
| CRM و چرخه سفارش/تدارکات | 6 J | commercial-rnd.js و مسیرهای commerce | commerce-route-types.spec.js / K، فقط ناوبری | roadmap P1؛ تکمیل lead/opportunity و سفارش/تأمین پس از هسته، پوشش کامل اثبات نشده |
| بودجه و کنترل تعهد | 6 J | enterprise-iran.js / enterprise-iran-v2.js (مسیرهای دقیق نیازمند ممیزی) | آزمون ردیفی هنوز مستند نشده | scope roadmap؛ وابسته به هسته و گزارش |
| HR/حقوق/تنخواه | 6 J | enterprise-iran-v2.js, platform-modules.js | platform-office.spec.js / K صرفاً launcher | محرمانگی، posting، بیمه/مالیات و کنترل نقش هنوز پذیرش مستقل ندارند |
| دارایی ثابت و استهلاک | 6/7 J | phase5-enterprise.js | آزمون ردیفی هنوز مستند نشده | طراحی/پوشش ثبت و برگشت، دفتر و نگهداری لازم |
| ارز، holding، بین‌شرکتی، تلفیق | 7 J | companies.js, phase5-enterprise.js, phase6-reporting.js (بخش‌های موجود) | شواهد یکپارچگی تلفیق ارائه نشده | roadmap V4 تصریح کرده رابطه والد معادل تلفیق نیست |
| ساخت/BOM/WIP، خدمات، نگهداری | 7 J | مسیر دقیق پیاده‌سازی هنوز تأیید نشده | فاقد شاهد پذیرش در این checkpoint | فقط پس از پیش‌نیازها و محدوده مصوب |
| آمادگی انتشار | 5 I | workflows, Pages, rollback | K,W,Security / مبنا | PR253 ادغام نشده، PR254 شکست Quality؛ آزمون مستقل متصل، تطبیق و قبول مالک لازم |

## Gate register و ترتیب
1. A/B: PR257 QA در حال بررسی؛ عدم قطع پذیرش B03. QA و سند مستقل مجاز.
2. C/D: #229 پس از گیت بازیابی؛ اجرای مالی واحد؛ سپس #245/#246، #248، #238؛ E/F و #223 متناسب وابستگی.
3. G/H/I: گزارش، داده تاریخی، ورود واقعی، reconciliation و readiness؛ انتشار نهایی نزد Codex-main.
4. J: هسته وابسته پیش‌نیاز؛ اتوماسیون فریز حفظ شود.

## checkpoint
این سند inventory اولیه و نگاشت درخواست‌های صریح V2 به مسیر/آزمون موجود است؛ نه بسته پیاده‌سازی و نه پذیرش. مستندات قدیمی 260 فصل و همه مسیرهای فعال API هنوز کامل تطبیق نشده‌اند؛ برای هر ردیف نتیجه دقیق، fixture/role، test command، run، SHA، reviewer و release link در ادامه ثبت شود. شواهد ردیف فاقد آزمون را با درصد پیشرفت جایگزین نکن. هیچ SQL/production/main تغییر نکرده است.

## checkpoint دوم — شواهد واقعی CI و تفکیک آزمون‌های مالی
- PR257 در SHA `4aa787b4ecac56985769aaa8bf9cb2053bf86252`: Quality [45396542861](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45396542861) FAIL؛ 260/261 آزمون مرورگر موفق. خطای C8 رفع شده؛ بازیابی همگام‌سازی همچنان مردود است (تغییر ناخواسته داده‌های پیش‌فرض پس از بازیابی و یک فراخوانی ذخیره با تأخیر). WP1 45396542730 و Security 45396542923 PASS؛ WP2 برای این SHA مشاهده نشد. تحویل شواهد به PR254، PR257 و Issue256 ثبت شده؛ پذیرش B03 باز است.
- PR259 در SHA `5fcbbfbc3351324e35394949e794344d222ef85e` (پیش از افزودن این checkpoint): Quality [45396870346](https://github.com/davoodmehraban89/Factor-easy/actions/runs/45396870346)، WP1 45396870371 و Security 45396870205 PASS؛ WP2 مشاهده نشد. این نتیجه تنها مربوط به SHA پیشین است، نه commit جدید یا تأیید محصول.
- ممیزی فهرست تست‌های `scripts/accounting-document-workflow.spec.js` در PR253 (blob `eb114b79712f97028e1963fa0a0145ff5e39d997`): سه expected RED صریح #229 برای Save خرید، ذخیره فروش رسمی با سند پیش‌نویس پیوندی، و ذخیره اصلاح خرید ثبت‌شده. این سه مورد مستقل‌اند؛ سبز بودن Quality به معنی رفع آن‌ها نیست. تست‌های مجاور شامل پیش‌نویس قابل ویرایش پس از reload، ثبت صریح سند متوازن، اصلاح سند دستی، حفظ سابقه در اصلاح/ابطال فروش و خرید، کنترل حساب سال مالی، F2 و مانده پرداخت تخصیص‌نیافته است. عنوان تست شاهد دامنه است نه اثبات نتیجه ردیفی یا آزمون با سرویس واقعی.
- برای پذیرش #229 هر سه مورد باید با اصلاح واقعی و بدون کاهش شرط‌ها به PASS معمولی تبدیل شوند؛ شواهد سرور و مرورگر در کنار نتیجه دفتر کل لازم است. تغییر دامنه این checkpoint صرفاً همین سند M01 است؛ هیچ اجرای SQL، ادغام یا انتشار انجام نشد.
