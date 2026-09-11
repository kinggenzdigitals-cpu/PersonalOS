/**
 * Asks Supabase which social auth providers are actually enabled, so the app
 * never renders a sign-in button that is guaranteed to fail with
 * "Unsupported provider: provider is not enabled".
 *
 * Supabase is the single source of truth here on purpose. The obvious
 * alternative — a NEXT_PUBLIC_* flag — is inlined at build time, so enabling
 * Google in the Supabase dashboard would change nothing until someone
 * remembered to also flip the env var and redeploy. That drift fails silently
 * and in the most confusing direction, so we ask Supabase on each auth-page
 * render instead.
 *
 * The parser lives in auth-provider-state.ts because this module cannot be
 * loaded outside Next (see the `server-only` import below).
 */

// Importing "server-only" makes an accidental client import a build error
// rather than a silent bug: in the browser the Data Cache options below are
// ignored, so the button would re-fetch on every render and lose its cache.
import "server-only";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { parseProviderState, type ProviderState } from "@/lib/auth-provider-state";

export type { ProviderState };

/**
 * How long we wait on Supabase, in ms.
 *
 * The lookup is rendered inside a Suspense boundary (see
 * components/auth/google-sign-in.tsx), so waiting here delays only the social
 * button, never the email form or response headers. Two seconds gives the live
 * Supabase endpoint enough room during an ordinary slow round trip without
 * leaving the streamed slot pending for long during an outage.
 */
const SETTINGS_TIMEOUT_MS = 2_000;

/**
 * How long an upstream failure is remembered before we try again.
 *
 * Next's Data Cache only stores 200 responses, so a timeout or a 500 teaches it
 * nothing: without this mark, every render during an outage re-discovers the
 * outage and pays the full timeout for it. One failure parks the lookup for a
 * window instead, making an outage cost roughly one slow attempt per server
 * instance rather than one per page view. Best-effort by design — it is
 * in-memory, per instance, and dies with it, which is the right trade for a
 * button whose worst failure is hiding itself.
 */
const FAILURE_COOLDOWN_MS = 30_000;

/** Epoch ms before which we skip the upstream call. 0 = ask now. */
let retryUpstreamAt = 0;

/**
 * Never throws. Every failure — missing env, timeout, non-200, junk body —
 * lands on "unknown" so that a provider lookup can never take down sign-in.
 */
export async function googleProviderState(): Promise<ProviderState> {
  if (Date.now() < retryUpstreamAt) return "unknown";

  try {
    // supabaseUrl()/supabaseAnonKey() throw by design when the env vars are
    // absent (they are placeholders in local .env.local). Reading them INSIDE
    // the try is what keeps a missing env var from 500ing the whole page.
    const endpoint = `${supabaseUrl()}/auth/v1/settings`;

    const res = await fetch(endpoint, {
      // The publishable/anon key. It is already shipped to every browser, so
      // sending it here exposes nothing new.
      //
      // It goes in `apikey` rather than `Authorization` because Next treats an
      // authorization (or cookie) header as a hint that a response is
      // user-specific; `apikey` is also simply what Supabase expects.
      headers: { apikey: supabaseAnonKey() },
      signal: AbortSignal.timeout(SETTINGS_TIMEOUT_MS),
      // Provider switches are operational settings. `no-store` makes a
      // dashboard change visible on the next auth-page render; Next's Data
      // Cache can otherwise retain the old value across Vercel deployments.
      cache: "no-store",
    });

    // A non-200 body may still be JSON; parsing it would misreport the state.
    if (!res.ok) {
      failed(`HTTP ${res.status} from ${endpoint}`);
      return "unknown";
    }

    retryUpstreamAt = 0;
    return parseProviderState(await res.json(), "google");
  } catch (err) {
    // Say something. Swallowing this silently is how the last auth incident
    // here burned days: the only symptom outside the server is "the Google
    // button vanished", which is indistinguishable from the provider simply
    // being switched off — exactly the distinction ProviderState exists to keep.
    failed(err instanceof Error ? err.message : String(err));
    return "unknown";
  }
}

function failed(reason: string) {
  retryUpstreamAt = Date.now() + FAILURE_COOLDOWN_MS;
  console.warn(
    `[auth-providers] Supabase settings lookup failed (${reason}); ` +
      `hiding social sign-in buttons and retrying in ${FAILURE_COOLDOWN_MS / 1000}s.`,
  );
}
