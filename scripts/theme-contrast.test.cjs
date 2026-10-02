"use strict";
/**
 * Custom-theme contrast. Every role color is also a TEXT color (text-brand,
 * text-tab-active…) on the fixed dark card, so whatever the user picks,
 * themeVars() must hand CSS values that read there, and the ink it pairs with
 * each fill must read on that fill. Also checks that the pre-paint script in
 * src/app/layout.tsx sets byte-identical values, so the two can't drift.
 *
 * Compiled to .tmp-test by the "test:theme-contrast" script, then run on bare
 * node — no dependencies.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  themeVars,
  PRESETS,
  DEFAULT_COLORS,
  shuffleColors,
  contrastRatio,
  ensureReadableOn,
  readableForeground,
} = require("../.tmp-test/theme.js");

const CARD = "#071a31";
const BACKGROUND = "#031124";

let passed = 0;
let failed = 0;
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}${detail ? `\n    ${detail}` : ""}`);
  }
}

// Deterministic PRNG so a failure reproduces.
let seed = 0x5eed;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const randomHex = () =>
  "#" +
  [0, 0, 0]
    .map(() => Math.floor(rand() * 256).toString(16).padStart(2, "0"))
    .join("");

const EDGE = ["#000000", "#0f172a", CARD, BACKGROUND, "#ffffff", "#fff", "#0F172A", "#808080"];
const samples = [
  ...PRESETS.map((p) => p.colors),
  ...EDGE.map((c) => ({ primary: c, secondary: c, accent: c, tab: c })),
];
for (let i = 0; i < 200; i++) {
  samples.push({
    primary: randomHex(),
    secondary: randomHex(),
    accent: randomHex(),
    tab: randomHex(),
  });
}

const TEXT_TOKENS = ["--brand", "--brand-2", "--accent-brand", "--tab-active", "--primary"];
const FILL_PAIRS = [
  ["--brand", "--brand-foreground"],
  ["--primary", "--primary-foreground"],
  ["--sidebar-primary", "--sidebar-primary-foreground"],
  ["--tab-active", "--tab-active-foreground"],
];

// --- 1 + 2. Text on the card / page, and ink on each fill -------------------
for (const colors of samples) {
  const v = themeVars(colors);
  const tag = JSON.stringify(colors);
  for (const k of TEXT_TOKENS) {
    const onCard = contrastRatio(v[k], CARD);
    const onPage = contrastRatio(v[k], BACKGROUND);
    ok(`${k} readable on --card for ${tag}`, onCard >= 4.5, `${v[k]} is ${onCard.toFixed(2)}:1`);
    ok(`${k} readable on --background for ${tag}`, onPage >= 4.5, `${v[k]} is ${onPage.toFixed(2)}:1`);
  }
  for (const [fill, ink] of FILL_PAIRS) {
    const r = contrastRatio(v[ink], v[fill]);
    ok(`${ink} readable on ${fill} for ${tag}`, r >= 4.5, `${v[ink]} on ${v[fill]} is ${r.toFixed(2)}:1`);
  }
}

// --- The default palette is not altered --------------------------------------
{
  const v = themeVars(DEFAULT_COLORS);
  ok("default --brand unchanged", v["--brand"] === DEFAULT_COLORS.primary, v["--brand"]);
  ok("default --tab-active unchanged", v["--tab-active"] === DEFAULT_COLORS.tab, v["--tab-active"]);
  // globals.css pairs #168cff with the dark ink #04122e; custom mode used to
  // put white on it at 3.4:1.
  ok("default --brand-foreground is the globals.css ink", v["--brand-foreground"] === "#04122e", v["--brand-foreground"]);
}

// --- Presets need no adjustment, so their swatches are what gets applied -----
for (const p of PRESETS) {
  for (const [role, hex] of Object.entries(p.colors)) {
    ok(`preset ${p.name} ${role} passes as-is`, ensureReadableOn(hex) === hex, `${hex} -> ${ensureReadableOn(hex)}`);
  }
}

// --- ensureReadableOn leaves passing colors alone and only ever lightens ------
ok("passing color returned untouched", ensureReadableOn("#38b6ff") === "#38b6ff");
ok("near-black becomes readable", contrastRatio(ensureReadableOn("#0f172a"), CARD) >= 4.5);
ok("invalid input passes through", ensureReadableOn("not-a-color") === "not-a-color");
ok("readableForeground picks ink on light", readableForeground("#ffffff") === "#04122e");
ok("readableForeground picks white on dark", readableForeground("#000000") === "#ffffff");

// --- 3. Shuffle prefers colors that are already readable ----------------------
for (let i = 0; i < 50; i++) {
  const pool = [randomHex(), randomHex(), "#38b6ff", "#0f172a"];
  const out = shuffleColors({
    enabled: true,
    colors: { primary: pool[0], secondary: pool[1], accent: pool[2], tab: pool[3] },
    saved: [],
  });
  ok(`shuffle primary readable (pool ${pool.join(",")})`, contrastRatio(out.primary, CARD) >= 4.5, out.primary);
  const v = themeVars(out);
  ok("shuffle result readable after themeVars", TEXT_TOKENS.every((k) => contrastRatio(v[k], CARD) >= 4.5));
}

// --- 4. The pre-paint script sets exactly what themeVars() sets ---------------
const layout = fs.readFileSync(path.join(__dirname, "../src/app/layout.tsx"), "utf8");
const match = layout.match(/const THEME_INIT_SCRIPT = `([^`]*)`;/);
ok("THEME_INIT_SCRIPT found in layout.tsx", Boolean(match));
if (match) {
  const script = match[1];
  for (const colors of samples) {
    const set = {};
    const context = {
      localStorage: {
        getItem: (k) => (k === "fht-theme" ? JSON.stringify({ enabled: true, colors, saved: [] }) : null),
      },
      document: {
        documentElement: { style: { setProperty: (k, v) => { set[k] = v; } } },
      },
    };
    vm.runInNewContext(script, context);
    const expected = themeVars(colors);
    const same = JSON.stringify(set) === JSON.stringify(expected);
    ok(
      `pre-paint script matches themeVars for ${JSON.stringify(colors)}`,
      same,
      same ? "" : `script ${JSON.stringify(set)}\n    lib    ${JSON.stringify(expected)}`,
    );
  }
}

console.log(`theme-contrast: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
