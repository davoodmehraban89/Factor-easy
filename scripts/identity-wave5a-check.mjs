import fs from 'node:fs';import assert from 'node:assert/strict';
const core=fs.readFileSync('js/core.js','utf8'),invite=fs.readFileSync('js/organization-invitations.js','utf8'),html=fs.readFileSync('index.html','utf8'),migration=fs.readFileSync('supabase/migrations/20261002080000_identity_wave5a_bootstrap.sql','utf8');
assert(!core.includes("sb.from('licenses').select('*').eq('user_id',authUser.id).single()"),'base identity bootstrap must not require personal license');
assert(core.includes('shouldCreateUser:allowCreate'),'OTP creation must be explicitly mode-bound');
assert(html.includes('startIdentityOtp(false,false)')&&html.includes('startIdentityOtp(false,true)'),'OTP login/signup actions must be explicit for email or phone');
assert(invite.indexOf('await window.processFinoraInvitationFromUrl();')<invite.indexOf('return baseEnterAppInvitation(authUser);'),'invitation must be accepted before organization bootstrap');
for(const s of ['insert into public.organizations','insert into public.organization_members','insert into public.licenses','organization_id'])assert(migration.includes(s),s+' missing');
console.log('Wave 5a identity/bootstrap invariants passed');
