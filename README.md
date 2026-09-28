# فینورا (Finora) — نسخه ۱.۰

> وضعیت جاری: فاز ۳ برنامه شش‌فازی «در حال اجرا / تأیید نهایی نشده» است.
> آزمون‌های رفتاری، نقص‌هایی فراتر از کنترل‌های متنی قبلی پیدا کردند.
> مرجع ادامه: [وضعیت پروژه](PROJECT_STATUS.md)، [برنامه شش‌فازی](docs/SIX_PHASE_ROADMAP.md) و [آخرین تحویل](docs/handoff/LATEST_HANDOFF.md).
> کنترل‌های سمت مرورگر جایگزین تراکنش و کنترل‌های امنیتی پایگاه‌داده نیستند.

سامانه ابری صدور فاکتور و مدیریت مالی. داده‌ها و لایسنس روی Supabase نگهداری می‌شوند، ورود با Google یا کد یک‌بارمصرف ایمیل انجام می‌شود، و کنترل دسترسی و نقش مدیر کاملاً سمت سرور (RLS) است.

## راه‌اندازی یک‌بار مصرف (Supabase)

**۱. Google OAuth**
داشبورد Supabase → Authentication → Providers → Google: فعال کنید و Client ID / Client Secret را از Google Cloud Console (OAuth consent screen + Web application credentials) وارد کنید. Redirect URI که Google از شما می‌خواهد را از همین صفحه‌ی Supabase کپی کنید.

**۲. SMTP اختصاصی (برای کد ایمیل)**
داشبورد Supabase → Authentication → Emails → SMTP Settings: یک سرویس ارسال ایمیل (مثلاً Resend یا Brevo) وصل کنید. ایمیل داخلی Supabase محدودیت ارسال شدید دارد و برای استفاده‌ی عمومی کافی نیست.

**۳. Confirm email — روشن می‌ماند** (طبق درخواست). چون آدرس ایمیل واقعی کاربر با کد یک‌بارمصرف یا با Google تأیید می‌شود، نیازی به خاموش‌کردن آن نیست.

**۴. Site URL / Redirect URLs**
داشبورد Supabase → Authentication → URL Configuration: مقدار زیر را اضافه کنید:
```
https://davoodmehraban89.github.io/Factor-easy/
```

**۵. ساخت حساب مدیر** — با ایمیل واقعی `davoodmehraban89@gmail.com` یک‌بار در سایت ثبت‌نام/ورود کنید (با Google یا کد ایمیل)، سپس فقط با SQL زیر نقش مدیر بدهید:

```sql
update public.profiles set role = 'admin'
where email = 'davoodmehraban89@gmail.com';

update public.licenses set plan = 'lifetime', status = 'active', ends_at = date '2099-01-01'
where user_id = (select id from public.profiles where email = 'davoodmehraban89@gmail.com');
```

نقش مدیر هیچ راه دیگری برای گرفتن ندارد — نه از سمت کلاینت، نه با انتخاب نام کاربری خاصی؛ فقط با این SQL که مستقیم در پایگاه‌داده اجرا می‌شود.

## جریان ورود کاربر عادی
- **ادامه با Google:** انتخاب حساب گوگل → ورود مستقیم، بدون رمز جداگانه.
- **ادامه با کد ایمیل:** وارد کردن ایمیل → دریافت کد ۶ رقمی → تأیید کد → (برای حساب تازه) تعیین رمز عبور برای ورودهای بعدی.
- **ورود با ایمیل و رمز:** برای کسی که قبلاً رمز تعیین کرده.

## ساختار
- `index.html` — برنامه (تک‌فایل)
- `vendor/supabase.js` — کتابخانه‌ی supabase-js (نسخه‌ی ثابت، از همین دامنه بارگذاری می‌شود)
- `diag.html` — صفحه‌ی عیب‌یابی اتصال به Supabase (در صورت بروز مشکل اتصال از دستگاه کاربر)
- کلید داخل `index.html` کلید عمومی (publishable) است؛ **هرگز** کلید `service_role` را در کد نگذارید.

## وضعیت انتشار ۱.۰
- هسته مالی، خرید و فروش، دریافت/پرداخت، پروژه و زیرپروژه، گزارش مالی و چاپ حرفه‌ای در نسخه جاری فعال‌اند.
- کنترل کیفیت خودکار روی JavaScript و invariantهای محصول در GitHub Actions اجرا می‌شود.
- CodeQL روی JavaScript/TypeScript در خط انتشار اجرا می‌شود.
- استقرار production از شاخه `main` با GitHub Pages انجام می‌شود.

## محدودیت‌های شناخته‌شده
- اتصال واقعی به API سامانه مودیان پیاده‌سازی نشده (فقط فرم اطلاعات سند).
- PWA آفلاین (Service Worker و آیکن) در محدوده نسخه ۱.۰ نیست.
- فعال‌سازی Leaked Password Protection و تنظیم SMTP اختصاصی، تنظیمات عملیاتی Supabase هستند و باید در داشبورد سرویس فعال بمانند/فعال شوند.
- تفاوت‌های فیزیکی چاپگرها و درایورها خارج از تست خودکار مرورگر است؛ قالب رسمی A4 و غیررسمی A5 در کد و Quality Gate کنترل می‌شوند.
