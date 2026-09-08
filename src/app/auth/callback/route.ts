import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLogin } from "@/app/auth/actions";

/** Email-link `type` values Supabase can send to this route. */
const OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;
type OtpType = (typeof OTP_TYPES)[number];

function isOtpType(value: string | null): value is OtpType {
  return !!value && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * OAuth / email-link redirect handler: turns whatever Supabase sends back into
 * a session cookie, then forwards the user on.
 *
 * Supabase delivers email links in one of two shapes depending on the project's
 * flow and email templates:
 *
 *   ?code=<pkce code>              → exchangeCodeForSession
 *   ?token_hash=<hash>&type=<...>  → verifyOtp
 *
 * Handling only the first is why password-reset links dead-ended on the generic
 * "auth code error" page: a `token_hash` link has no `code`, so the route bailed
 * before it ever spoke to Supabase. (A third shape exists — tokens in the URL
 * *fragment* — but a fragment is never sent to the server, so /reset-password
 * picks that one up client-side.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorDescription = searchParams.get("error_description");
  const errorCode = searchParams.get("error_code");

  // Only allow safe, internal relative destinations.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/home";

  // A recovery link that fails should land back on "forgot password" with a
  // reason, not on a dead-end error page — the whole point is to get another
  // link sent.
  const isRecovery = type === "recovery" || next.startsWith("/reset-password");

  function fail(reason: "expired" | "invalid") {
    if (isRecovery) {
      const url = new URL("/forgot-password", origin);
      url.searchParams.set("error", reason);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // The user cancelled consent, or the link was expired/already used.
  if (errorDescription) {
    console.error("[auth/callback] provider error");
    return fail(errorCode === "otp_expired" ? "expired" : "invalid");
  }

  if (!code && !tokenHash) {
    console.error("[auth/callback] missing authorization code");
    return fail("invalid");
  }

  const supabase = await createClient();

  if (tokenHash) {
    if (!isOtpType(type)) {
      console.error("[auth/callback] unsupported otp type");
      return fail("invalid");
    }
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      // Log a safe message only — never the token or query string.
      console.error("[auth/callback] otp verification failed");
      return fail("expired");
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] code exchange failed");
      return fail("expired");
    }
  }

  await recordLogin();
  return NextResponse.redirect(`${origin}${next}`);
}
