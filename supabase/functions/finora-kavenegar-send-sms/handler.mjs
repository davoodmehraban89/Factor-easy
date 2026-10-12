// Finora Supabase Auth Send SMS Hook -> Kavenegar verification templates.
// Staged/offline only. No production deployment or Auth configuration is implied.
// Exact signed-body verification protects this endpoint even with verify_jwt=false.
export const KAVENEGAR_TEMPLATE = 'FinoraLogin';
const REPLAY_WINDOW_SECONDS = 300;
const MAX_BODY_BYTES = 8192;
const HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

function reply(status, error) {
  return new Response(error ? JSON.stringify({error}) : '{}', {status,headers:HEADERS});
}
function safeBase64Decode(raw) {
  const binary = atob(raw);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export function iranianSmsReceptor(phone) {
  // Supabase Auth uses E.164. Never infer identity from an arbitrary profile field.
  if (typeof phone !== 'string' || !/^\+989[0-9]{9}$/.test(phone)) return null;
  return '0' + phone.slice(3);
}
export async function verifyAuthSmsSignature(request, rawBody, rawSecret, nowMs = Date.now(), cryptoImpl = globalThis.crypto) {
  const webhookId = request.headers.get('webhook-id') || '';
  const timestampText = request.headers.get('webhook-timestamp') || '';
  const signatureText = request.headers.get('webhook-signature') || '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(webhookId) || !/^[0-9]{10,11}$/.test(timestampText)) return false;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(nowMs / 1000) - timestamp) > REPLAY_WINDOW_SECONDS) return false;
  if (!signatureText || signatureText.length > 1024 || !cryptoImpl?.subtle) return false;
  // The Supabase hook secret is typically v1,whsec_BASE64. Allow a rotated
  // set separated by |; never treat the displayed secret as a raw HMAC key.
  const secrets = String(rawSecret || '').split('|').slice(0,3);
  const signatures = signatureText.split(/\s+/).filter(s => s.startsWith('v1,')).slice(0,6);
  if (!signatures.length) return false;
  const signed = new TextEncoder().encode(webhookId + '.' + timestampText + '.' + rawBody);
  for (const entry of secrets) {
    const match = /^(?:v1,)?whsec_([A-Za-z0-9+/=]{32,})$/.exec(entry.trim());
    if (!match) continue;
    let keyBytes;
    try { keyBytes = safeBase64Decode(match[1]); } catch { continue; }
    if (keyBytes.length < 24 || keyBytes.length > 64) continue;
    const key = await cryptoImpl.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
    for (const signature of signatures) {
      try {
        const bytes = safeBase64Decode(signature.slice(3));
        if (bytes.length !== 32) continue;
        if (await cryptoImpl.subtle.verify('HMAC', key, bytes, signed)) return true;
      } catch { /* malformed signature */ }
    }
  }
  return false;
}
export async function handleFinoraKavenegarSms(request, {env = () => '', fetchImpl = fetch, nowMs = Date.now(), cryptoImpl = globalThis.crypto} = {}) {
  if (request.method !== 'POST') return reply(405, 'method_not_allowed');
  // Feature flag is mandatory, rather than silently treating an unconfigured hook as delivered.
  if (env('FINORA_KAVENEGAR_OTP_ENABLED') !== 'true') return reply(503, 'otp_not_enabled');
  const apiKey = String(env('KAVENEGAR_API_KEY') || '').trim();
  const hookSecret = String(env('SEND_SMS_HOOK_SECRET') || '').trim();
  if (!/^[A-Za-z0-9]{16,128}$/.test(apiKey) || !hookSecret) return reply(503, 'otp_secrets_not_configured');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(413, 'payload_too_large');
  if (!(await verifyAuthSmsSignature(request, raw, hookSecret, nowMs, cryptoImpl))) return reply(401, 'invalid_hook_signature');
  let event;
  try { event = JSON.parse(raw); } catch { return reply(400, 'invalid_hook_payload'); }
  const receptor = iranianSmsReceptor(event?.user?.phone);
  const token = event?.sms?.otp;
  if (!receptor || typeof token !== 'string' || !/^[0-9]{6,10}$/.test(token)) return reply(422, 'unsupported_phone_or_token');
  const body = new URLSearchParams({receptor,token,template:KAVENEGAR_TEMPLATE});
  // The provider requires the API key in its URL; never print URLs or response bodies.
  const providerUrl = 'https://api.kavenegar.com/v1/' + encodeURIComponent(apiKey) + '/verify/lookup.json';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetchImpl(providerUrl,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
      body:body.toString(),signal:controller.signal
    });
    if (!response.ok) return reply(502, 'sms_provider_failed');
    const receipt = await response.json();
    if (Number(receipt?.return?.status) !== 200) return reply(502, 'sms_provider_failed');
    return reply(200);
  } catch {
    // Never log OTP, mobile, user info, API key or provider request URL.
    return reply(502, 'sms_provider_unreachable');
  } finally {
    clearTimeout(timeout);
  }
}
