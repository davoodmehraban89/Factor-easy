# فینورا (Finora) — نسخه ۷.۰

سامانه ابری صدور فاکتور و مدیریت مالی. داده‌ها و لایسنس روی Supabase نگهداری می‌شوند و کنترل دسترسی سمت سرور (RLS) انجام می‌شود.

## راه‌اندازی یک‌بار مصرف (Supabase)
1. در داشبورد Supabase → Authentication → Providers → Email: گزینه‌ی **Confirm email** را خاموش کنید (ورود با نام کاربری از ایمیل ساختگی استفاده می‌کند).
2. با نام کاربری مدیر در سایت ثبت‌نام کنید، سپس نقش مدیر را با SQL زیر بدهید (فقط از داشبورد یا با دسترسی ادمین دیتابیس):

```sql
update public.profiles set role = 'admin' where username = 'aram';
update public.licenses set plan = 'lifetime', status = 'active', ends_at = date '2099-01-01'
  where user_id = (select id from public.profiles where username = 'aram');
```

## ساختار
- `index.html` — برنامه (تک‌فایل)
- `vendor/supabase.js` — کتابخانه‌ی supabase-js (نسخه‌ی ثابت، از همین دامنه بارگذاری می‌شود)
- کلید داخل `index.html` کلید عمومی (publishable) است؛ **هرگز** کلید `service_role` را در کد نگذارید.

## محدودیت‌های شناخته‌شده
- اتصال واقعی به API سامانه مودیان پیاده‌سازی نشده (فقط فرم اطلاعات سند).
- بازیابی رمز عبور ندارد (ورود با نام کاربری).
- PWA آفلاین (Service Worker و آیکن) هنوز اضافه نشده است.
