// This module reads the session cookie and its exported type now carries the
// user's email, so a stray import from a client component must fail the build
// rather than ship either into the browser bundle. Its sibling
// lib/entitlement.ts guards itself the same way.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
 * Only the identity lookup is memoized. The `profiles` row is deliberately left
 * out of the cache so a caller that writes to profiles and re-reads within the
 * same request still sees its own write.
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
 * The redirect ladder is security-relevant and ORDER-DEPENDENT:
 *
 *   1. signed out             → /login
 *   2. no profile row         → /onboarding
 *   3. status !== "active"    → /suspended
 *   4. must_change_password   → /change-password
 *   5. !onboarded             → /onboarding
 *
 * Steps 3 and 4 must stay AHEAD of step 5. A suspended account, or one holding
 * an admin-issued temporary password, is often also mid-onboarding; testing
 * `onboarded` first would send it to /onboarding instead, and finishing that
 * flow would drop it onto a protected page with the lockout never enforced.
 * Any future edit here must preserve every check and their exact order.
 */
export async function requireOnboardedAccount(): Promise<OnboardedAccount> {
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  // Suspended / revoked accounts are locked out of protected pages.
  if (profile.status && profile.status !== "active") redirect("/suspended");
  // Force a password change after an admin-issued temporary password.
  if (profile.must_change_password) redirect("/change-password");
  if (!profile.onboarded) redirect("/onboarding");

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
