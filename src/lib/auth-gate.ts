/**
 * The protected-area redirect ladder, as a pure decision so
 * scripts/auth-gate.test.cjs can pin its order on bare node.
 * requireOnboardedAccount() in lib/auth.ts is the only caller.
 */
import { isAccountLocked } from "./account-status";

/** The profiles columns the ladder reads. */
export type GateProfile = {
  status?: string | null;
  must_change_password?: boolean | null;
  onboarded?: boolean | null;
};

export type GateRedirect =
  | "/login"
  | "/onboarding"
  | "/suspended"
  | "/change-password";

/**
 * Where a request for a protected page must be sent instead, or null when it
 * may render. The ladder is security-relevant and ORDER-DEPENDENT:
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
export function gateRedirect(
  signedIn: boolean,
  profile: GateProfile | null | undefined,
): GateRedirect | null {
  if (!signedIn) return "/login";
  if (!profile) return "/onboarding";
  // Suspended / revoked accounts are locked out of protected pages.
  if (isAccountLocked(profile.status)) return "/suspended";
  // Force a password change after an admin-issued temporary password.
  if (profile.must_change_password) return "/change-password";
  if (!profile.onboarded) return "/onboarding";
  return null;
}
