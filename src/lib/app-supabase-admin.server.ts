// Server-only admin client for the PRODUCTION Supabase project (archivai.hu).
//
// The Lovable-managed `supabaseAdmin` (src/integrations/supabase/client.server.ts)
// reads process.env.SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which on this
// deployment point at the Lovable Cloud project (ychygdoirpngsgrqmlng) — NOT
// the production project where the app's data (shared_access, profiles,
// custom_categories, …) actually lives (jofxnjtktwuzmjjcgofw).
//
// The browser client in `src/lib/supabase.ts` is hardcoded to the production
// project, so any server function that needs to read/write the same data must
// use the production service-role credentials, exposed via these secrets:
//   - APP_SUPABASE_URL
//   - APP_SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createAppAdmin() {
  const url = process.env.APP_SUPABASE_URL;
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = [
      ...(!url ? ["APP_SUPABASE_URL"] : []),
      ...(!key ? ["APP_SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(
      `Missing production Supabase env var(s): ${missing.join(", ")}. ` +
        `Add them in Lovable Cloud secrets.`,
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

let _client: ReturnType<typeof createAppAdmin> | undefined;

export const appSupabaseAdmin = new Proxy({} as ReturnType<typeof createAppAdmin>, {
  get(_, prop, receiver) {
    if (!_client) _client = createAppAdmin();
    return Reflect.get(_client, prop, receiver);
  },
});
