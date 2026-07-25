/** Resolve the site origin for OAuth / email / checkout redirects. */
export function getSiteURL() {
  // 1. Explicit override wins.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // 2. On the client, use the current origin.
  if (typeof window !== "undefined") return window.location.origin;

  // 3. On Vercel, use the production domain it injects automatically
  //    (no manual env var needed).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  // 4. Local dev fallback.
  return "http://localhost:3000";
}
