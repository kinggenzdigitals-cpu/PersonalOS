/**
 * Normalises the optional "Screenshot link" on a feedback submission.
 * Dependency-free (the test harness compiles it alone).
 *
 * The link is rendered as a clickable anchor in the super-admin console, so
 * only https is stored: never javascript:, data:, http: or an OS protocol
 * handler. Migration 0030 enforces the same rule in the database, because a
 * signed-in user can also insert feedback straight through PostgREST.
 */
export const SCREENSHOT_URL_MAX = 2048;

export type ScreenshotUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

const INVALID: ScreenshotUrlResult = {
  ok: false,
  error: "Screenshot link must be an https:// URL.",
};

export function normalizeScreenshotUrl(
  raw: string | null | undefined,
): ScreenshotUrlResult {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return { ok: true, url: null };
  if (trimmed.length > SCREENSHOT_URL_MAX) return INVALID;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return INVALID;
  }
  if (url.protocol !== "https:") return INVALID;

  // Store the parsed form, never the raw input: it is percent-encoded, so it
  // holds no whitespace, and it is exactly what was checked.
  const normalized = url.toString();
  if (normalized.length > SCREENSHOT_URL_MAX) return INVALID;
  return { ok: true, url: normalized };
}
