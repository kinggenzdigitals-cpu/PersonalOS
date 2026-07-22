/** Resolve the site origin for OAuth / email redirects. */
export function getSiteURL() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000")
  );
}
