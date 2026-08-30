/**
 * Maps raw Supabase auth error messages to friendly, user-safe copy. In
 * particular a network failure (e.g. "Failed to fetch" when the Supabase
 * project is paused or unreachable) becomes a calm "temporarily unavailable"
 * message instead of a scary raw error.
 */
export function friendlyAuthError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();

  if (
    !m ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("fetch") ||
    m.includes("load failed") ||
    m.includes("bad gateway") ||
    m.includes("timeout") ||
    m.includes("503") ||
    m.includes("502")
  ) {
    return "Our service is temporarily unavailable. Please try again in a moment.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email or password doesn't match our records.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox for the link.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message ?? "Something went wrong. Please try again.";
}
