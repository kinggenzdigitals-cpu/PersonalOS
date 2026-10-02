/**
 * When each legal page last changed, as ISO dates. The page's "Last updated"
 * line and its sitemap <lastmod> both read from here, so they cannot drift
 * apart. Bump the date in the same change that edits the page's text — a
 * build timestamp here would claim every deploy changed the policy.
 */
export const PRIVACY_UPDATED = "2026-09-15";
export const TERMS_UPDATED = "2026-09-15";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "2026-09-15" → "September 2026". Parsed by hand rather than through Date so
 * the server's timezone can never shift a first-of-the-month date back a month.
 */
export function legalDateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) throw new Error(`Invalid legal date: ${iso}`);
  return `${month} ${m[1]}`;
}
