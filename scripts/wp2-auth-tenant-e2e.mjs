import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const api = process.env.API_URL;
const anon = process.env.ANON_KEY;
const service = process.env.SERVICE_ROLE_KEY;
const db = process.env.DB_URL;
for (const [name, value] of Object.entries({ API_URL: api, ANON_KEY: anon, SERVICE_ROLE_KEY: service, DB_URL: db })) {
  if (!value) throw new Error(`Missing Supabase local environment value: ${name}`);
}
const suffix = `wp2-${Date.now()}`;
const users = [];
async function adminCreate(email) {
  const response = await fetch(`${api}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: `T3st-${crypto.randomUUID()}-Aa9!`, email_confirm: true, user_metadata: { username: email.split('@')[0] } })
  });
  const body = await response.json();
  assert.equal(response.status, 200, `admin create user failed: ${JSON.stringify(body)}`);
  return body.id;
}
async function signIn(email, password) {
  const response = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  assert.equal(response.status, 200, `password sign-in failed: ${JSON.stringify(body)}`);
  assert.ok(body.access_token && body.user?.id);
  return body.access_token;
}
function sql(statement) {
  const result = spawnSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-c', statement], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr || result.stdout}`);
}
async function rest(path, token, init = {}) {
  return fetch(`${api}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: anon, Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
}
try {
  const emails = [`owner-a-${suffix}@example.test`, `owner-b-${suffix}@example.test`];
  const passwords = [`T3st-A-${crypto.randomUUID()}-Aa9!`, `T3st-B-${crypto.randomUUID()}-Aa9!`];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${api}/auth/v1/admin/users`, {
      method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emails[i], password: passwords[i], email_confirm: true, user_metadata: { username: `w2${i}${Date.now()}` } })
    });
    const body = await response.json();
    assert.equal(response.status, 200, `user provisioning failed: ${JSON.stringify(body)}`);
    users.push(body.id);
  }
  const orgA = crypto.randomUUID(), orgB = crypto.randomUUID();
  const q = (s) => `'${s.replaceAll("'", "''")}'`;
  sql(`
    insert into public.organizations(id,owner_user_id,name) values
      (${q(orgA)},${q(users[0])},'WP2 tenant A ${suffix}'),
      (${q(orgB)},${q(users[1])},'WP2 tenant B ${suffix}');
    update public.licenses set organization_id=${q(orgA)} where user_id=${q(users[0])};
    update public.licenses set organization_id=${q(orgB)} where user_id=${q(users[1])};
    insert into public.organization_members(organization_id,user_id,status,is_owner)
    values (${q(orgA)},${q(users[0])},'active',true),(${q(orgB)},${q(users[1])},'active',true);
  `);
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${api}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emails[i], password: passwords[i] })
    });
    const body = await response.json();
    assert.equal(response.status, 200, `real Auth sign-in failed: ${JSON.stringify(body)}`);
    assert.equal(body.user.id, users[i]);
    tokens.push(body.access_token);
  }
  const visibleA = await rest('organizations?select=id,name&order=name', tokens[0]);
  const visibleB = await rest('organizations?select=id,name&order=name', tokens[1]);
  assert.equal(visibleA.status, 200); assert.equal(visibleB.status, 200);
  const rowsA = await visibleA.json(), rowsB = await visibleB.json();
  console.log('WP2 tenant diagnostics', JSON.stringify({ users, orgA, orgB, rowsA, rowsB }));
  assert.ok(rowsA.some(x => x.id === orgA));
  assert.ok(!rowsA.some(x => x.id === orgB), 'tenant A JWT leaked tenant B organization');
  assert.ok(rowsB.some(x => x.id === orgB));
  assert.ok(!rowsB.some(x => x.id === orgA), 'tenant B JWT leaked tenant A organization');
  const membersA = await rest('organization_members?select=organization_id,user_id', tokens[0]);
  const membersB = await rest('organization_members?select=organization_id,user_id', tokens[1]);
  assert.equal(membersA.status, 200); assert.equal(membersB.status, 200);
  const mA = await membersA.json(), mB = await membersB.json();
  assert.ok(mA.some(x => x.organization_id === orgA && x.user_id === users[0]), 'tenant A cannot read its own membership');
  assert.ok(!mA.some(x => x.organization_id === orgB), 'tenant A can read tenant B membership');
  assert.ok(mB.some(x => x.organization_id === orgB && x.user_id === users[1]), 'tenant B cannot read its own membership');
  assert.ok(!mB.some(x => x.organization_id === orgA), 'tenant B can read tenant A membership');
  console.log('WP2_AUTH_TENANT_E2E_PASS: two Auth-issued JWTs; organization and membership RLS isolation verified through PostgREST.');
} finally {
  // Supabase Local is disposable; preserve immutable audit evidence.
  // The workflow tears down this entire database after the test.
  console.log(`WP2 fixture lifecycle: ${users.length} Auth users provisioned in disposable database.`);
}
