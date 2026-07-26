import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabaseAnonKey, supabaseUrl } from "./env";

declare global {
  interface Window {
    __SB__?: { url: string; key: string };
  }
}

/**
 * Browser-side Supabase client. Use inside Client Components.
 *
 * Prefers the runtime config injected by the root layout (window.__SB__), which
 * is resolved on the server and immune to build-time NEXT_PUBLIC_* inlining
 * failures. Falls back to the inlined env vars if the script isn't present.
 */
export function createClient() {
  const runtime = typeof window !== "undefined" ? window.__SB__ : undefined;
  const url = runtime?.url ?? supabaseUrl();
  const key = runtime?.key ?? supabaseAnonKey();
  return createBrowserClient<Database>(url, key);
}
