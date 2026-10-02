/**
 * Account-status rules shared by the page ladder and server actions
 * (lib/auth.ts), the onboarding / change-password pages, and the admin action
 * that changes status. Dependency-free so scripts/account-status.test.cjs can
 * run it on bare node.
 */

/**
 * True when the account may not use the app (suspended or revoked). A missing
 * status reads as active, matching the column default — the same rule the
 * database applies in public.account_active() (migration 0027).
 */
export function isAccountLocked(status: string | null | undefined): boolean {
  return Boolean(status) && status !== "active";
}

/**
 * The GoTrue ban that goes with an account status. A banned user can't
 * refresh their session or sign in again; "none" lifts the ban on
 * reactivation. GoTrue durations stop at hours, so 876000h (~100 years)
 * stands in for "until an admin says otherwise".
 */
export function banDurationFor(status: string): string {
  return status === "active" ? "none" : "876000h";
}
