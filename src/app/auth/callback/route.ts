import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-link redirect handler: exchanges the auth code for a session
 * cookie (PKCE via Supabase SSR), then forwards the user on. New users land on
 * /home, which sends them to onboarding when their profile isn't set up yet;
 * Free entitlement is the default (no paid subscription row required).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  // Only allow safe, internal relative destinations.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/home";

  const errorUrl = `${origin}/auth/auth-code-error`;

  // The user cancelled consent or Google returned an error.
  if (errorDescription) {
    console.error("[auth/callback] provider error");
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    console.error("[auth/callback] missing authorization code");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Log a safe message only — never the code, tokens, or query string.
    console.error("[auth/callback] code exchange failed");
    return NextResponse.redirect(errorUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const provider =
      typeof user.app_metadata?.provider === "string"
        ? user.app_metadata.provider
        : "unknown";
    const userAgent = request.headers.get("user-agent")?.slice(0, 240) ?? "unknown";
    // Login must still succeed while a new migration is rolling out. The
    // settings page will show history once security_events is available.
    await supabase.rpc("record_security_event", {
      p_event_type: "login_success",
      p_metadata: { provider, user_agent: userAgent },
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
