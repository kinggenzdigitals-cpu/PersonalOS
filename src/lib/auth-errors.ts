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

  // ---- Password recovery -------------------------------------------------

  // Supabase couldn't hand the message off to its mail provider. Almost always
  // configuration rather than anything the person typed.
  if (m.includes("error sending") || m.includes("smtp")) {
    return "We couldn't send that email. Please try again shortly — if it keeps failing, the email service needs attention.";
  }
  if (m.includes("redirect") && m.includes("invalid")) {
    return "This sign-in link isn't configured correctly yet. Please contact support.";
  }
  if (
    m.includes("token has expired") ||
    m.includes("otp_expired") ||
    m.includes("expired or is invalid")
  ) {
    return "That code has expired. Request a new one.";
  }
  if (m.includes("invalid token") || m.includes("token is invalid")) {
    return "That code isn't right. Check the email and try again.";
  }
  if (m.includes("same password") || m.includes("should be different")) {
    return "That's your current password. Choose a different one.";
  }
  if (m.includes("password should be") || m.includes("weak password")) {
    return "Choose a stronger password — at least 8 characters.";
  }

  // Errors that survive with no readable text ("{}", "[object Object]") tell
  // the user nothing, so don't parrot them back.
  if (m === "{}" || m === "[object object]" || m === "null") {
    return "Our service is temporarily unavailable. Please try again in a moment.";
  }

  return message ?? "Something went wrong. Please try again.";
}
