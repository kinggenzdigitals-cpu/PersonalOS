const RECENT_AUTH_SECONDS = 15 * 60;
const LOGIN_METHODS = new Set(["password", "oauth", "otp", "magiclink", "sso/saml"]);

/** Accept only claims already verified by Supabase auth.getClaims(). */
export function hasRecentAuthentication(
  claims: Record<string, unknown> | null | undefined,
  userId: string,
  now = Date.now(),
): boolean {
  if (
    claims?.sub !== userId ||
    typeof claims.session_id !== "string" ||
    !claims.session_id ||
    !Array.isArray(claims.amr)
  ) return false;

  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as Record<string, unknown>;
    if (typeof method !== "string" || !LOGIN_METHODS.has(method)) return false;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
    const age = now / 1000 - timestamp;
    return age >= 0 && age <= RECENT_AUTH_SECONDS;
  });
}
