import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminUserManagementHandler } from "./handler.mjs";

Deno.serve(createAdminUserManagementHandler({
  createClient,
  getEnv: (name: string) => Deno.env.get(name),
}));
