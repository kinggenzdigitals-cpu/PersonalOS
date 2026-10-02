"use strict";
/**
 * Static accessibility contract for src/components. Each rule is a regression
 * that has already shipped once:
 *
 * 1. A bare <Label> labels nothing. Radix Label is a plain <label>: without
 *    htmlFor it isn't tied to a Select trigger or Textarea, so the transfer
 *    form's From/To pickers had no accessible name. A label naming a group of
 *    buttons must render as a span (asChild) with an id for aria-labelledby.
 * 2. Removing the outline without a replacement leaves keyboard focus
 *    invisible (WCAG 2.4.7), as on the task/bill/ledger edit triggers.
 * 3. An icon-only trash button needs a name, or a screen reader announces
 *    just "button" right before "Save changes".
 *
 * Plain node, no dependencies.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../src/components");
// shadcn primitives restore focus their own way (ring on the parent, a
// focused item background, or a dialog that is never a tab stop itself).
const PRIMITIVES = path.join(ROOT, "ui");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const problems = [];
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(path.join(__dirname, ".."), file).replace(/\\/g, "/");
  const primitive = file.startsWith(PRIMITIVES);

  // 1. <Label ...> opening tags (may span lines) need htmlFor or asChild+id.
  if (!primitive) {
    for (const m of src.matchAll(/<Label\b([^>]*)>/g)) {
      const attrs = m[1];
      const tied = /\bhtmlFor=/.test(attrs) || (/\basChild\b/.test(attrs) && /\bid=/.test(attrs));
      if (!tied) problems.push(`${rel}:${lineOf(src, m.index)} <Label> without htmlFor (or asChild + id)`);
    }
  }

  // 2. className strings that drop the outline must bring a focus indicator.
  if (!primitive) {
    for (const m of src.matchAll(/className="([^"]*)"/g)) {
      const cls = m[1].split(/\s+/);
      const drops = cls.some((c) => /^(focus-visible:|focus:)?outline-(none|hidden)$/.test(c) || c === "focus:ring-0");
      const restores = cls.some((c) => /^(focus-visible:|focus:)(ring-|border-)/.test(c) && c !== "focus:ring-0");
      if (drops && !restores) problems.push(`${rel}:${lineOf(src, m.index)} outline removed with no focus-visible ring`);
    }
  }

  // 3. A <Button> whose only content is a Trash2Icon must carry aria-label.
  for (const m of src.matchAll(/<Button\b([^>]*)>\s*<Trash2Icon\b[^>]*\/>\s*<\/Button>/g)) {
    if (!/\baria-label=/.test(m[1])) problems.push(`${rel}:${lineOf(src, m.index)} icon-only delete button has no aria-label`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `  FAIL: ${p}`).join("\n"));
  console.log(`a11y-contract: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("a11y-contract: all components pass");
