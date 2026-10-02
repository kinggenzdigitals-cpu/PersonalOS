"use strict";
/**
 * Tests for the ranged pager behind "Download my data". Compiled to .tmp-test
 * first, then run on bare node — no dependencies.
 *
 * The stub behaves like PostgREST: it serves `.range(from, to)` inclusively and
 * never returns more than `maxRows` rows per request, with no error.
 */
const { fetchAllPages } = require("../.tmp-test/fetch-all-pages.js");

let passed = 0;
let failed = 0;
function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}\n    expected ${e}\n    got      ${a}`);
  }
}

function table(total, { maxRows = 1000, failAt = null } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls = [];
  const page = async (from, to) => {
    calls.push([from, to]);
    if (failAt !== null && from >= failAt) {
      return { data: null, error: { message: "boom" } };
    }
    return { data: rows.slice(from, Math.min(to + 1, from + maxRows)), error: null };
  };
  return { page, calls };
}

async function main() {
  // --- The bug: one un-ranged request keeps only max-rows ----------------------
  {
    const { page } = table(2500);
    const { data } = await page(0, Number.MAX_SAFE_INTEGER);
    eq("an un-ranged read is capped at 1000", data.length, 1000);
  }

  // --- Every row comes back ------------------------------------------------------
  for (const total of [0, 1, 999, 1000, 1001, 2500, 3000]) {
    const { page } = table(total);
    const { rows, error } = await fetchAllPages(page);
    eq(`${total} rows: all returned`, rows.length, total);
    eq(`${total} rows: no error`, error, null);
    eq(`${total} rows: no duplicates`, new Set(rows.map((r) => r.id)).size, total);
  }

  // --- The ranges requested -------------------------------------------------------
  {
    const { page, calls } = table(2500);
    await fetchAllPages(page);
    eq("2500 rows: three contiguous ranges", calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  }
  {
    const { page, calls } = table(2000);
    await fetchAllPages(page);
    eq("exact multiple: one extra empty page ends it", calls.length, 3);
  }
  {
    const { page, calls } = table(250);
    const { rows } = await fetchAllPages(page, 100);
    eq("custom page size", rows.length, 250);
    eq("custom page size ranges", calls, [[0, 99], [100, 199], [200, 299]]);
  }

  // --- Errors stop the walk and are handed back --------------------------------------
  {
    const { page } = table(2500, { failAt: 1000 });
    const { rows, error } = await fetchAllPages(page);
    eq("error on page two: returned", error, { message: "boom" });
    eq("error on page two: rows so far kept", rows.length, 1000);
  }
  {
    const { page } = table(10, { failAt: 0 });
    const { rows, error } = await fetchAllPages(page);
    eq("error on page one: returned", error, { message: "boom" });
    eq("error on page one: no rows", rows.length, 0);
  }

  // --- A null data field is an empty page, not a crash ---------------------------------
  {
    const { rows, error } = await fetchAllPages(async () => ({ data: null, error: null }));
    eq("null data: empty result", rows, []);
    eq("null data: no error", error, null);
  }

  console.log(`fetch-all-pages: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
