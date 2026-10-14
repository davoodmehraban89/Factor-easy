# پشتیبان‌گیری مستقل Finora ERP — بدون کارت بانکی و اشتراک مصرف‌محور

**وضعیت پذیرش:** ابزار و آزمون‌های مصنوعی آماده‌اند؛ تهیه بکاپ واقعی از Production و بازیابی روی پایگاه داده آزمایشی **هنوز انجام نشده‌اند**.

## محیط و حدود مسئولیت

- برنامه: Finora ERP Production، شناسه Supabase: `hcsixhqbyuhpshfwqpjx`.
- ابزار: Python 3.10+، PostgreSQL client هم‌نسخه سرور (فعلاً PostgreSQL 17)، `age` و `age-keygen`؛ همگی بدون اشتراک ابری قابل اجرا هستند.
- مقصد: یک حافظه محلی یا خارجی **بیرون از مخزن GitHub**؛ پس از بکاپ، یک کپی دوم روی دستگاه/حافظه مستقل.
- امنیت: `pg_dump -Fc` خروجی را مستقیماً به رمزنگاری `age` انتقال می‌دهد، بدون ذخیره dump رمزگشایی‌شده روی دیسک. پسورد تولیدی دیتابیس فقط با ورودی مخفی از ترمینال خوانده می‌شود؛ هرگز در چت، فایل مخزن یا آرگومان خط فرمان قرار نمی‌گیرد.
- **محدوده:** داده‌های PostgreSQL؛ نه فایل‌های واقعی Supabase Storage، نه اسرار Edge Functions، نه تنظیمات Auth/OAuth/DNS و نه بکاپ‌های دیگر.
- ابزار هیچ داده‌ای را روی Production ویرایش نمی‌کند. حالت `restore-test` فقط برای یک پایگاه داده خالی، دورریختنی و روی `localhost` است.

## ۱. ساخت کلید رمزنگاری روی رایانه خودت

از منابع رسمی ابزار `age` را نصب کن: https://age-encryption.org/ . کلید خصوصی را فقط روی رایانه/حافظه امن مالک تولید کن؛ **به هیچ وجه کلید خصوصی را در GitHub، Actions، Supabase یا چت نفرست**.

در PowerShell ویندوز:

```powershell
age-keygen -o "F:\FinoraPrivateKey\finora-age-identity.txt"
age-keygen -y "F:\FinoraPrivateKey\finora-age-identity.txt"
```

دستور دوم رشته عمومی با پیشوند `age1` می‌دهد. این رشته را فقط به عنوان `--recipient` استفاده کن. برای کلید خصوصی یک نسخه امن مستقل نگه دار؛ اگر آن را گم کنی، نسخه رمزنگاری‌شده دیگر بازیابی نمی‌شود.

## ۲. تهیه نسخه واقعی فقط از اتصال مدیریتی مجاز

اطلاعات **Host، Port، Database و User** را از پروژه عملیاتی Supabase، بخش `Connect → Database` بخوان. برای `pg_dump` از Direct Connection یا **Session pooler** استفاده کن؛ Transaction pooler مناسب نیست. در برخی ISPها Direct به IPv6 نیاز دارد؛ Session pooler جایگزین است.

رایانه باید آنلاین باشد و `pg_dump` نسخه سازگار و `age` در `PATH` نصب باشند. در ریشه Clone مخزن اجرا کن:

```powershell
py -3 scripts\finora_local_backup.py backup `
  --host "SESSION_POOLER_HOST_FROM_SUPABASE" `
  --port 5432 `
  --user "SESSION_USER_FROM_SUPABASE" `
  --database postgres `
  --recipient "age1YOUR_PUBLIC_RECIPIENT" `
  --output-dir "E:\FinoraBackups"
```

نمونه تک‌خطی همان فرمان برای کپی آسان‌تر:

```powershell
py -3 scripts\finora_local_backup.py backup --host "SESSION_POOLER_HOST_FROM_SUPABASE" --port 5432 --user "SESSION_USER_FROM_SUPABASE" --database postgres --recipient "age1YOUR_PUBLIC_RECIPIENT" --output-dir "E:\FinoraBackups"
```

رمز دیتابیس با ورودی پنهان درخواست می‌شود و در متن راهنما/کد ذخیره نخواهد شد. اگر لازم است برنامه‌ها را با مسیر کامل معرفی کنی، گزینه‌های `--pg-dump` و `--age` پشتیبانی می‌شوند.

**خروجی موفق:** فایل رمزنگاری‌شده با پسوند `.dump.age` و فایل متادیتای `.dump.age.json`. فایل دوم اندازه و SHA-256 را ثبت می‌کند؛ هر دو را به حافظه دوم منتقل کن. در خطا، خروجی ناقص حذف می‌شود.

## ۳. صحت‌سنجی آرشیو

```powershell
py -3 scripts\finora_local_backup.py verify --backup "E:\FinoraBackups\EXACT_FILENAME.dump.age" --identity "F:\FinoraPrivateKey\finora-age-identity.txt"
```

این مرحله فقط تطابق هش و اندازه، رمزگشایی age در حافظه و خواندن فهرست آرشیو با `pg_restore --list` را بررسی می‌کند. **قبول‌شدن آن به معنای بازیابی موفق نیست.**

## ۴. بازیابی آزمایشی روی دیتابیس لوکال، هرگز Production

یک PostgreSQL **لوکال** از قبل راه‌اندازی کن و یک دیتابیس **خالی و دورریختنی** با نام `finora_restore_test_20261014` بساز. سرویس لوکال نباید به Production تونل یا فوروارد شده باشد. سپس:

```powershell
py -3 scripts\finora_local_backup.py restore-test --backup "E:\FinoraBackups\EXACT_FILENAME.dump.age" --identity "F:\FinoraPrivateKey\finora-age-identity.txt" --test-host 127.0.0.1 --test-port 5432 --test-user postgres --test-database finora_restore_test_20261014
```

این حالت هیچ مقصد Remote یا نام معمولی مثل `postgres` را قبول نمی‌کند؛ دیتابیس آزمایشی باید خالی باشد. بازگردانی کامل Supabase روی PostgreSQL خام ممکن است به extension/roleهای مدیریت‌شده نیاز داشته باشد؛ موفقیت واقعی تنها پس از بررسی داده‌های بازیابی‌شده، صحت ردیف‌ها و RBAC/RLS قابل تأیید است.

## ۵. برنامه نگه‌داری و معیار پذیرش

- فعلاً **بکاپ دستی** است. برای زمان‌بندی روی Windows Task Scheduler باید رایانه در ساعت اجرا روشن باشد و رمز پایگاه داده از یک مخزن امن مثل Windows Credential Manager دریافت شود؛ رمز را در فایل PowerShell، BAT، ENV قابل commit یا خط فرمان ثابت ذخیره نکن.
- هر بار فایل رمزنگاری‌شده و manifest را حفظ کن و یک نسخه دوم **خارج از رایانه** نگه دار. فعلاً حذف خودکار وجود ندارد. بازیابی آزمایشی را دست‌کم ماهانه تکرار کن.
- برنامه اصلی/اطلاعات مالی در اثر این ابزار تغییر نمی‌کنند. فعال‌سازی GitHub↔Supabase با `Deploy to production=OFF` موضوعی مستقل است.
- کارت بانکی، Cloudflare R2 و سرویس پرداخت مبتنی بر مصرف **لازم نیستند**. حافظه محلی/خارجی ممکن است هزینه سخت‌افزاری داشته باشد.
- تا زمانی که بکاپ واقعی، انتقال به حافظه دوم و بازیابی کامل در محیط ایزوله تأیید نشده‌اند: `PRODUCTION_BACKUP_NOT_RUN / RECOVERY_NOT_VERIFIED`.

## ۶. آزمون کنترل توسعه‌دهنده

```bash
python3 scripts/finora_local_backup_test.py -v
```

این آزمون‌ها از `pg_dump`، `age` و `pg_restore` **ساختگی** استفاده می‌کنند و به Production وصل نمی‌شوند؛ رمزنگاری واقعی و بازیابی عملیاتی باید جداگانه آزمایش شوند.
