import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Browser-side Supabase client. Use inside Client Components.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
