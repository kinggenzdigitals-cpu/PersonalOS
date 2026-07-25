import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client. Server-only — bypasses RLS. Use ONLY in trusted
 * server contexts (e.g. the Xendit webhook) to write rows on the user's behalf.
 * Never import this into client code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin client is not configured.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
