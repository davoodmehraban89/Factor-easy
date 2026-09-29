# Finora Information Architecture v2 — Enterprise Navigation Contract

Date: 2026-09-29
Status: APPROVED DIRECTION / implementation in progress

## Owner requirement
The previous shell technically had a module rail and contextual panel, but the contextual panel was too shallow and several workspaces dumped multiple unrelated tasks into one long page. The approved visual target is the canonical 1536×864 Finora screenshot: narrow RTL module rail, a second contextual subsystem panel, top company/fiscal/search context, and a focused central workspace. `خانه` is not a business module and is replaced by `داشبورد`.

## Research synthesis
This IA is a synthesis, not a copy of one product.

- Sepidar publicly separates accounting, receipts/payments, suppliers/inventory, customers/sales, fixed assets and other systems; its accounting product emphasizes standard chart coding, legal books, fiscal-year closing and account-turnover/balance reports. Training material also shows a right-side module list and separate module/submenu navigation.
- Rahkaran/System Group structures the ERP as financial, sales, supply/logistics, production, HR and management-accounting solutions; its financial family includes general-ledger concepts rather than mixing every transaction into one page.
- Holoo material repeatedly exposes task/report concepts such as purchase/sales, counterparties, cheques/bank, inventory and separate general/subsidiary/detail ledgers. User-facing material emphasizes quick learnability.
- Gheyas user feedback is useful as a negative constraint: users value quick entry but complain when common actions require too much navigation or UI friction.
- Independent user feedback on Iranian accounting products repeatedly rewards simple/learnable flows and criticizes inconsistent or overly complicated interfaces. Finora therefore prioritizes stable module locations, explicit task names, shallow click depth and no duplicate “mystery” routes.

## Navigation principles
1. One primary rail item = one business subsystem, not a random feature bucket.
2. Clicking a primary module opens a rich contextual panel; it does not dump every form into the workspace.
3. Context panel groups are domain language: اطلاعات پایه، عملیات، دفاتر و گزارش‌ها، کنترل/ابزارها.
4. Each actionable menu item opens one focused task surface. Shared data may reuse the same underlying engine, but unrelated cards are hidden.
5. No fake menu items: an item is exposed only when the corresponding working lifecycle/view exists.
6. Cross-module masters have one canonical home; secondary routes may deep-link to them but must not duplicate data.
7. Global search indexes task-level commands, not just modules.
8. Desktop follows the approved two-tier shell; responsive mode may collapse the contextual panel but preserves hierarchy.

## Primary module rail
1. داشبورد
2. حسابداری
3. بازرگانی
4. خزانه‌داری
5. پروژه و قرارداد
6. انبار
7. دارایی ثابت
8. گزارش‌ها
9. تنظیمات

The old `کالا` and generic `ERP` rail entries are removed. کالا/خدمات belongs to بازرگانی master data; inventory and fixed assets are first-class operational modules. Currency, cost centers, import/backup and integrations are routed to accounting/settings where users expect them.

## Contextual menu contract

### داشبورد
- نمای مدیریتی: داشبورد

### حسابداری
**اطلاعات پایه**
- کدینگ حساب‌ها
- تفصیلی‌های شناور
- قواعد حساب و تفصیلی
- سال‌های مالی
- شعب
- ارز و نرخ تبدیل
- مراکز هزینه

**عملیات**
- ثبت سند حسابداری
- فهرست اسناد حسابداری

**دفاتر و گزارش‌ها**
- تراز آزمایشی
- دفتر کل / معین / تفصیلی
- صورت سود و زیان و وضعیت مالی
- جریان وجوه نقد
- سن مطالبات و بدهی‌ها

### بازرگانی
**اطلاعات پایه**
- اشخاص
- کالا و خدمات
**فروش**
- فاکتور فروش
**خرید**
- فاکتور خرید
**کنترل**
- هزینه و درآمد

### خزانه‌داری
**عملیات**
- دریافت و پرداخت
- چک‌ها و صیاد
No bank-account master is exposed until its full lifecycle exists.

### پروژه و قرارداد
**اطلاعات پایه**
- پروژه‌ها
**عملیات پیمان**
- قراردادها، الحاقیه‌ها، کسورات، تضمین‌ها و صورت‌وضعیت‌ها (existing contracting workspace)
**گزارش**
- گزارش پروژه و پیمان

### انبار
- تعریف انبار
- گردش انبار
- انبارگردانی
- موجودی و بهای میانگین
These are task-focused projections of the existing inventory engine.

### دارایی ثابت
- ثبت دارایی
- دفتر دارایی‌ها
- استهلاک و سوابق

### گزارش‌ها
- گزارش‌های مدیریتی/عملیاتی
- تراز آزمایشی
- دفاتر حسابداری
- صورت‌های مالی
- جریان نقد
- سن مطالبات/بدهی
- پروژه/پیمان

### تنظیمات
- شرکت‌ها و تنظیمات عمومی
- تنظیمات عملیاتی
- ورود/خروج داده و پشتیبان
- اتصالات و API
- کاربران و لایسنس (admin only)

## Explicitly not exposed as operational
Budgeting, payroll, tax-authority live submission and any other future module are not placed in the active rail until their data lifecycle, permissions, accounting integration and tests exist.

## Acceptance criteria
- No primary rail label `خانه`, `کالا` or generic `ERP`.
- Accounting contextual panel contains at least the grouped base/operations/books-report hierarchy above.
- Clicking task-level accounting entries focuses only the relevant card/report, not the entire accounting-foundation/journal/report dump.
- Commerce owns sales, purchases, contacts and products.
- Global command search can navigate task-level entries.
- Existing data and accounting engines are reused; no duplicate masters.
- Real-DOM smoke verifies the rail labels, accounting groups and at least account-chart, journal-entry, journal-register and trial-balance task focusing.
