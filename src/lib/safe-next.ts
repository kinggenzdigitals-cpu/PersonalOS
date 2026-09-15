/**
 * Validates a post-auth redirect target so it can only ever point back into
 * this app. Dependency-free (the test harness compiles it alone) and safe to
 * import from client components, route handlers and server actions alike.
 *
 * The inline check this replaces — startsWith("/") && !startsWith("//") — let
 * "/\evil.com" through: WHATWG URL parsing treats "\" as "/" for http(s), so it
 * becomes the protocol-relative "//evil.com" and leaves the site. The same
 * parser strips tabs and newlines, so "/\t/evil.com" ends up there too. Rather
 * than chase every spelling, resolve against a sentinel origin and require
 * that origin to survive — that is the actual question being asked.
 */
const SENTINEL = "https://app.invalid";

export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/home",
): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return fallback;
  }
  // Leading whitespace is trimmed by the URL parser, so it must be refused here.
  if (!raw.startsWith("/")) return fallback;

  let url: URL;
  try {
    url = new URL(raw, SENTINEL);
  } catch {
    return fallback;
  }
  if (url.origin !== SENTINEL) return fallback;

  // Return the parsed form, never the raw input, so what gets navigated to is
  // exactly what was checked.
  return url.pathname + url.search + url.hash;
}
