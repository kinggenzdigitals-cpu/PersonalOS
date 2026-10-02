// This module reads the session cookie and its exported type now carries the
// user's email, so a stray import from a client component must fail the build
// rather than ship either into the browser bundle. Its sibling
// lib/entitlement.ts guards itself the same way.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enforceCurrentDevice } from "@/lib/devices";
import { isAccountLocked } from "@/lib/account-status";
import { gateRedirect } from "@/lib/auth-gate";
import type { Profile } from "@/lib/supabase/types";

/**
 * The authenticated user for this request, memoized for the render pass.
 *
 * Every protected page renders inside (app)/layout.tsx, and the layout AND the
 * page each call into this module — so without memoization one page view paid
 * two separate supabase.auth.getUser() network round-trips for the same answer.
 * React's cache() is what Next's own auth guide prescribes for exactly this
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md → "Creating a
 * Data Access Layer").
 *
 * The identity lookup (and the device gate, below) are memoized. The `profiles`
 * row is deliberately left out of the cache so a caller that writes to profiles
 * and re-reads within the same request still sees its own write.
 *
 * Exported so lib/entitlement.ts can share the same answer — (app)/layout.tsx
 * awaits the gate and getEntitlement() on every authenticated page render, and
 * before this they each paid their own round-trip.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Returns the authenticated user, or redirects to /login. */
export async function requireUser() {
  const user = await getAuthUser();

  if (!user) redirect("/login");
  return user;
}

/**
 * The device gate, memoized for the render pass the same way getAuthUser is.
 * The layout and the page each run requireOnboardedAccount(), so without this
 * one full page load made two identical account_devices reads and two
 * last_seen_at writes. A redirect it throws is cached and rethrown to the
 * second caller, so the gate behaves exactly as before.
 */
const enforceCurrentDeviceOnce = cache(enforceCurrentDevice);

/**
 * The signed-in user plus a session client, or null when signed out OR when
 * the account is suspended / revoked. Never redirects, so a Server Action can
 * return its own error result instead of writing.
 *
 * requireOnboardedAccount() below only runs on page render; without this an
 * already-open tab of a suspended account could keep calling actions. RLS
 * enforces the same rule (migration 0027); this is the app-level half, and the
 * only guard on paths RLS can't see: GoTrue's updateUser and service-role
 * writes.
 *
 * No profile row yet (pre-onboarding) counts as active, as it does in the
 * database. A failed status read fails closed.
 */
export async function requireActiveUser() {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || isAccountLocked(profile?.status)) return null;
  return { supabase, user };
}

/** A signed-in, onboarded account: the profile row plus its auth identity. */
export type OnboardedAccount = {
  profile: Profile;
  /**
   * Lives on the auth user, not on the profile — `profiles` has no email
   * column — so it has to be carried out of the gate deliberately.
   */
  email: string | null;
};

/**
 * Returns the profile AND the signed-in email, enforcing onboarding.
 *
 * This is the ONE place the protected-area gate is implemented;
 * requireOnboardedProfile() below is a projection of it rather than a second
 * copy, so the two can never drift apart.
 *
 * The redirect ladder is security-relevant and ORDER-DEPENDENT. It is decided
 * by gateRedirect() in lib/auth-gate.ts, which documents the order and is
 * pinned by scripts/auth-gate.test.cjs — change it there, never inline here.
 */
export async function requireOnboardedAccount(): Promise<OnboardedAccount> {
  const supabase = await createClient();
  const user = await getAuthUser();

  // No user, no profile read: the ladder stops a signed-out request at step 1.
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const to = gateRedirect(!!user, profile);
  // `to` is null only for a signed-in user with a profile row; the extra
  // checks just let TypeScript see that.
  if (to || !user || !profile) redirect(to ?? "/login");

  await enforceCurrentDeviceOnce(user.id);

  // The email rides out on the user this gate already fetched. Asking the
  // header for it separately would mean a second supabase.auth.getUser() on
  // every authenticated page render.
  return { profile, email: user.email ?? null };
}

/**
 * Returns the authenticated user + profile, enforcing onboarding.
 * Redirects to /login when signed out, or /onboarding when not yet onboarded.
 *
 * Signature and behaviour are unchanged — most pages in (app) call this — it
 * simply drops the email half of requireOnboardedAccount().
 */
export async function requireOnboardedProfile(): Promise<Profile> {
  return (await requireOnboardedAccount()).profile;
}

/** Returns the current profile without enforcing onboarding (may be null). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data ?? null;
}
