import fs from 'node:fs';
function ok(v,m){if(!v)throw new Error(m)}
const html=fs.readFileSync('index.html','utf8'),core=fs.readFileSync('js/core.js','utf8'),admin=fs.readFileSync('js/admin.js','utf8'),ux=fs.readFileSync('js/ux-hardening-r2.js','utf8'),sql=fs.readFileSync('supabase/migrations/20261007163500_phone_identity_profile.sql','utf8'),edge=fs.readFileSync('supabase/functions/admin-user-management/index.ts','utf8');
ok(html.includes('ایجاد کاربر جدید')&&html.includes('modal-admin-reset-password'),'Admin must expose create-user and temporary-password controls.');
ok(admin.includes("admin_set_user_limit")&&admin.includes('new_max_users:users'),'License edit must persist named-user capacity.');
ok(admin.includes("sb.functions.invoke('admin-user-management'")&&edge.includes('profile?.role!=="admin"'),'Privileged identity mutations must use an admin-verified server boundary.');
ok(edge.includes('admin.auth.admin.createUser')&&edge.includes('admin.auth.admin.updateUserById'),'Server boundary must support user creation and password reset.');
ok(core.includes("signInWithPassword(credentials)")&&core.includes("{phone,password:pass}")&&core.includes("type:'sms'"),'Client auth must support phone password and SMS OTP.');
ok(sql.includes('alter column email drop not null')&&sql.includes('add column if not exists phone')&&sql.includes('update_my_identity_profile'),'Database identity bootstrap must support phone-only users and self-service username.');
ok(ux.includes('--card-bg:#122238')&&ux.includes('.form-group label')&&ux.includes('table td{background:#102038'),'Dark theme must explicitly preserve readable surfaces and text.');
console.log('Admin identity, phone auth and dark-mode invariants passed.');
