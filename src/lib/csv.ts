/**
 * CSV / bank-statement parsing. Pure and client-safe, and written by hand
 * rather than pulling in a parser dependency.
 *
 * Philippine banks and e-wallets do NOT share a statement format: BPI, GCash,
 * Maya, UnionBank and Security Bank all differ in delimiter, date order, column
 * names, and how they signal a debit. So nothing here assumes a layout — the
 * columns are auto-detected as a starting guess and the user confirms them.
 */

export type CsvTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  /** Source line number (1-based, whole file) for each row in `rows`. */
  lineNumbers: number[];
  /** Set when the file is malformed in a way that loses data silently. */
  warning: string | null;
};

/** RFC-4180-ish: quoted fields, escaped quotes, embedded newlines, CRLF. */
export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  const rowLines: number[] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        // Normalise CRLF inside a quoted field too, or a stray \r ends up in
        // the merchant text and therefore in the fingerprint.
        if (ch !== "\r") field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      rowLines.push(rowStartLine);
      row = [];
      field = "";
      line++;
      rowStartLine = line;
    } else if (ch === "\r") {
      // handled by the \n branch
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
    rowLines.push(rowStartLine);
  }

  // An unbalanced quote swallows everything after it into one field. Silently
  // returning that as "one row" hides an arbitrary amount of missing data.
  const warning = inQuotes
    ? "This file has an unclosed quotation mark, so part of it could not be read. Check the file and re-export it."
    : null;

  const keep = rows
    .map((r, i) => ({ r, line: rowLines[i] }))
    .filter(({ r }) => r.some((c) => c.trim() !== ""));
  if (keep.length === 0) {
    return { headers: [], rows: [], delimiter, lineNumbers: [], warning };
  }

  // Header = the first row of the MOST COMMON width. Using the widest row let
  // a single data row containing an unquoted delimiter become the header,
  // which silently discarded the real header and every row above it.
  const freq = new Map<number, number>();
  for (const { r } of keep) freq.set(r.length, (freq.get(r.length) ?? 0) + 1);
  let width = keep[0].r.length;
  let bestFreq = 0;
  for (const [len, n] of freq) {
    if (n > bestFreq || (n === bestFreq && len > width)) {
      bestFreq = n;
      width = len;
    }
  }

  const headerIdx = keep.findIndex(({ r }) => r.length === width);
  const headers = keep[headerIdx].r.map((h) => h.trim());
  const body = keep.slice(headerIdx + 1);

  return {
    headers,
    // Pad short rows so a mapped index never reads undefined off the end.
    rows: body.map(({ r }) =>
      r.length >= width ? r : [...r, ...Array(width - r.length).fill("")],
    ),
    delimiter,
    lineNumbers: body.map(({ line: l }) => l),
    warning,
  };
}

/**
 * Delimiter frequency counted OUTSIDE quoted fields only — a Particulars
 * column full of "REF;123;POS" would otherwise make a comma-separated file
 * look semicolon-separated.
 */
function detectDelimiter(text: string): string {
  const sample = text.slice(0, 20000);
  const counts = new Map<string, number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
    ["|", 0],
  ]);
  let inQuotes = false;
  for (let i = 0; i < sample.length; i++) {
    const ch = sample[i];
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    const n = counts.get(ch);
    if (n !== undefined) counts.set(ch, n + 1);
  }
  let best = ",";
  let bestCount = 0;
  for (const [d, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

// ---- Column mapping -------------------------------------------------------

export type ColumnMap = {
  date: number | null;
  description: number | null;
  /** Single signed amount column. */
  amount: number | null;
  /** Or a separate debit/credit pair, which many banks use instead. */
  debit: number | null;
  credit: number | null;
  reference: number | null;
};

const PATTERNS: Record<keyof ColumnMap, RegExp> = {
  date: /^(date|txn date|transaction date|posting date|value date|date posted|petsa)$/i,
  description: /^(description|details|particulars|narrative|merchant|payee|remarks|transaction|memo)$/i,
  amount: /^(amount|txn amount|transaction amount|value|halaga)$/i,
  debit: /^(debit|withdrawal|withdrawals|money out|paid out|outflow|dr)$/i,
  credit: /^(credit|deposit|deposits|money in|paid in|inflow|cr)$/i,
  reference: /^(reference|reference no\.?|ref|ref no\.?|transaction id|confirmation no\.?)$/i,
};

/** Best-effort guess. Exact header match first, then a contains fallback. */
export function autoDetectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    date: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    reference: null,
  };
  const keys = Object.keys(PATTERNS) as (keyof ColumnMap)[];

  for (const key of keys) {
    const exact = headers.findIndex((h) => PATTERNS[key].test(h.trim()));
    if (exact !== -1) {
      map[key] = exact;
      continue;
    }
    const loose = headers.findIndex((h) =>
      new RegExp(key, "i").test(h.replace(/[^a-z]/gi, "")),
    );
    if (loose !== -1) map[key] = loose;
  }

  // A debit/credit pair supersedes a single amount column.
  if (map.debit !== null && map.credit !== null) map.amount = null;
  return map;
}

// ---- Value parsing --------------------------------------------------------

/**
 * Money from a statement cell. Handles "1,234.56", "₱1,234.56", "(500.00)"
 * for negatives, trailing CR/DR, and blank cells. Returns null when the cell
 * holds no number at all.
 */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bDR\b/i.test(s)) negative = true;
  if (/-\s*$/.test(s)) negative = true;

  s = s.replace(/[^0-9.,-]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  // Decimal separator. A comma is only a DECIMAL point when it is followed by
  // exactly one or two digits at the end ("1.234,56"); otherwise it is a
  // thousands separator ("1,234").
  //
  // The naive `lastComma > lastDot` test gets this catastrophically wrong for
  // "1,234", which has no dot at all (lastDot === -1): it becomes "1.234",
  // i.e. the amount silently divided by a thousand.
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }

  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  return negative ? -rounded : rounded;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Statement date → YYYY-MM-DD. `dayFirst` disambiguates 03/04/2026, which is
 * genuinely ambiguous; the caller infers it from the file (see inferDayFirst).
 */
export function parseDate(
  raw: string | undefined,
  dayFirst = false,
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO first — unambiguous.
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return ymd(+iso[1], +iso[2], +iso[3]);

  // "5 Jan 2026" / "Jan 5, 2026" / "05-JAN-2026"
  const named = s.match(/^(\d{1,2})[\s-]*([A-Za-z]{3,})[\s-,]*(\d{2,4})$/);
  if (named) {
    const m = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (m) return ymd(year(+named[3]), m, +named[1]);
  }
  const named2 = s.match(/^([A-Za-z]{3,})[\s-]*(\d{1,2})[\s-,]+(\d{2,4})$/);
  if (named2) {
    const m = MONTHS[named2[1].slice(0, 3).toLowerCase()];
    if (m) return ymd(year(+named2[3]), m, +named2[2]);
  }

  // Numeric d/m/y or m/d/y
  const num = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (num) {
    const a = +num[1];
    const b = +num[2];
    const y = year(+num[3]);
    // A value over 12 can only be the day, whatever the stated order.
    if (a > 12) return ymd(y, b, a);
    if (b > 12) return ymd(y, a, b);
    return dayFirst ? ymd(y, b, a) : ymd(y, a, b);
  }
  return null;
}

function year(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** True when any numeric date in the column has a first part above 12. */
export function inferDayFirst(values: string[]): boolean {
  for (const v of values) {
    const m = v?.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) return true;
    if (+m[2] > 12) return false;
  }
  return false;
}

// ---- Row building ---------------------------------------------------------

export type ParsedRow = {
  line: number; // 1-based row number in the file body
  date: string; // YYYY-MM-DD
  description: string;
  /** Positive number; `type` carries the direction. */
  amount: number;
  type: "income" | "expense";
  reference: string | null;
  fingerprint: string;
};

export type RowError = { line: number; reason: string };

/**
 * A stable identity for an imported line, so re-importing the same statement
 * is a no-op rather than a double-post. Deliberately a readable composite
 * rather than a hash — when a dedupe looks wrong, you can see why.
 */
export function fingerprint(input: {
  accountId: string;
  date: string;
  amount: number;
  type: string;
  description: string;
}): string {
  const desc = input.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 60);
  return [
    input.accountId,
    input.date,
    input.amount.toFixed(2),
    input.type,
    desc,
  ].join("|");
}

export function buildRows(
  table: CsvTable,
  map: ColumnMap,
  opts: { accountId: string; dayFirst: boolean; expenseIsNegative: boolean },
): { rows: ParsedRow[]; errors: RowError[] } {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  // Two genuinely distinct statement lines can be identical (two ₱50 jeepney
  // fares on one day). Without an occurrence counter they'd share a
  // fingerprint, and the partial unique index would reject the WHOLE batch.
  // The counter is deterministic in file order, so re-importing the same file
  // still produces the same fingerprints and still dedupes correctly.
  const seen = new Map<string, number>();

  table.rows.forEach((cells, i) => {
    const line = table.lineNumbers[i] ?? i + 1;
    const get = (idx: number | null) =>
      idx === null ? undefined : cells[idx];

    const date = parseDate(get(map.date), opts.dayFirst);
    if (!date) {
      errors.push({ line, reason: "Couldn't read the date" });
      return;
    }

    let signed: number | null = null;
    if (map.debit !== null || map.credit !== null) {
      const debit = parseAmount(get(map.debit));
      const credit = parseAmount(get(map.credit));
      if (debit && debit !== 0) signed = -Math.abs(debit);
      else if (credit && credit !== 0) signed = Math.abs(credit);
    } else {
      const a = parseAmount(get(map.amount));
      if (a !== null && a !== 0) {
        signed = opts.expenseIsNegative ? a : -a;
      }
    }

    if (signed === null || signed === 0) {
      errors.push({ line, reason: "Couldn't read an amount" });
      return;
    }

    const description = (get(map.description) ?? "").trim().slice(0, 200);
    const type: "income" | "expense" = signed > 0 ? "income" : "expense";
    const amount = Math.abs(signed);
    const reference = (get(map.reference) ?? "").trim() || null;

    const base = fingerprint({
      accountId: opts.accountId,
      date,
      amount,
      type,
      description,
    });
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    rows.push({
      line,
      date,
      description,
      amount,
      type,
      reference,
      fingerprint: occurrence === 1 ? base : `${base}#${occurrence}`,
    });
  });

  return { rows, errors };
}
