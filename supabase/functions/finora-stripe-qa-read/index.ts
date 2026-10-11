import { handleStripeQaPreview } from './handler.mjs';

// Authentication is also enforced by Supabase platform: verify_jwt = true.
Deno.serve((request: Request) => handleStripeQaPreview(request, {
  env: (name: string) => Deno.env.get(name),
  fetchImpl: fetch,
}));
