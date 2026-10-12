// Server-only Supabase Auth Send SMS Hook entrypoint.
// In a later owner-approved activation, deploy this function with verify_jwt=false
// because GoTrue signs HTTP hooks using Standard Webhooks, not a user JWT.
// All requests MUST pass signed-body verification in handler.mjs.
import {handleFinoraKavenegarSms} from './handler.mjs';
Deno.serve((request: Request) => handleFinoraKavenegarSms(request, {
  env: (name: string) => Deno.env.get(name) || ''
}));
