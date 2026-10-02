"use strict";
/**
 * Public pages: SEO metadata, robots rules, and the copy that makes promises
 * about billing, downgrades and who processes data. Each copy check is tied to
 * the code it describes, so changing one side without the other fails here.
 * Source is read as text with comments stripped, so a comment quoting the old
 * wording can't satisfy or trip a check.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel) => stripComments(fs.readFileSync(path.join(root, rel), "utf8"));
let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};

// --- robots.txt ----------------------------------------------------------------
// A disallowed URL is never fetched, so its noindex is never read and the bare
// URL can still be indexed from a link.
const robots = read("src/app/robots.ts");
const disallow = (robots.match(/disallow:\s*\[([\s\S]*?)\]/) || [])[1];
ok(disallow, "robots.ts must have a disallow list");
for (const p of ["/invite", "/login", "/signup", "/forgot-password", "/reset-password"]) {
  ok(!disallow.includes(`"${p}`), `robots.ts must not disallow ${p}: the page's noindex would never be read`);
}
ok(disallow.includes('"/change-password"'), "robots.ts should disallow /change-password (auth-only, redirects crawlers)");

// --- next.config.ts --------------------------------------------------------------
const nextConfig = read("next.config.ts");
ok(
  /source:\s*"\/invite\/:path\*"[\s\S]*?"X-Robots-Tag"[\s\S]*?noindex/.test(nextConfig),
  "next.config.ts must send X-Robots-Tag: noindex on /invite/:path*",
);
ok(!/xendit/i.test(nextConfig), "next.config.ts still mentions Xendit; billing is PayMongo");
function sourceText(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceText(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? fs.readFileSync(full, "utf8") : "";
  }).join("\n");
}
const src = sourceText(path.join(root, "src"));
for (const [, host] of nextConfig.matchAll(/hostname:\s*"([^"]+)"/g)) {
  ok(src.includes(host), `next.config.ts allow-lists ${host} for the image optimizer, but nothing in src/ uses it`);
}

// --- (auth) pages: noindex and real titles --------------------------------------------
ok(
  /robots:\s*\{\s*index:\s*false/.test(read("src/app/(auth)/layout.tsx")),
  "the (auth) layout must set robots noindex for the sign-in and password pages",
);
for (const page of ["forgot-password", "reset-password"]) {
  ok(
    /export const metadata[\s\S]*?title:\s*"[^"]+"/.test(read(`src/app/(auth)/${page}/layout.tsx`)),
    `(auth)/${page} is a client page; its layout must give it a title`,
  );
}

// --- Open Graph and canonical ------------------------------------------------------------
const metadataBlock = (text) => (text.match(/export const metadata: Metadata = \{([\s\S]*?)\n\};/) || [])[1] || "";
const layoutOg = (read("src/app/layout.tsx").match(/openGraph:\s*\{([^}]*)\}/) || [])[1];
ok(layoutOg !== undefined, "layout.tsx must keep its site-wide openGraph block");
ok(!/\burl\s*:/.test(layoutOg), "layout.tsx openGraph must not set url: every inheriting page would claim the site root");

const home = metadataBlock(read("src/app/page.tsx"));
ok(/\.\.\.BASE_OPEN_GRAPH/.test(home) && /url:\s*"\/"/.test(home), "/ openGraph needs BASE_OPEN_GRAPH and url \"/\"");
ok(!/images\s*:/.test(home), "/ openGraph must not set images: that stops the colocated opengraph-image supplying it");

for (const route of ["pricing", "terms", "privacy"]) {
  const meta = metadataBlock(read(`src/app/${route}/page.tsx`));
  ok(meta.includes(`canonical: "/${route}"`), `/${route} needs alternates.canonical "/${route}"`);
  ok(/\.\.\.BASE_OPEN_GRAPH/.test(meta), `/${route} openGraph must spread BASE_OPEN_GRAPH (site name, locale)`);
  ok(meta.includes(`url: "/${route}"`), `/${route} openGraph needs url "/${route}"`);
  ok(/images:\s*\[SHARED_OG_IMAGE\]/.test(meta), `/${route} overrides openGraph, so it must list SHARED_OG_IMAGE or lose og:image`);
}
const seo = read("src/lib/seo.ts");
ok(seo.includes('url: "/opengraph-image"'), "SHARED_OG_IMAGE must point at the root opengraph-image route");
const ogImage = read("src/app/opengraph-image.tsx");
ok(!/generateImageMetadata/.test(ogImage), "generateImageMetadata changes the image URL; update SHARED_OG_IMAGE");

// --- /pricing heading outline --------------------------------------------------------------
const pricing = read("src/app/pricing/page.tsx");
const h1 = pricing.indexOf("<h1");
const h2 = pricing.indexOf("<h2");
const cards = pricing.indexOf("<PricingCards");
ok(h1 !== -1 && h1 < h2 && h2 < cards, "/pricing needs an h2 between its h1 and the plan cards' h3s");

// --- Privacy Policy names every processor the code sends data to -------------------------------
const privacy = read("src/app/privacy/page.tsx");
const layout = read("src/app/layout.tsx");
ok(privacy.includes("Supabase"), "Privacy Policy must name Supabase");
ok(privacy.includes("Vercel"), "Privacy Policy must name Vercel (hosting)");
if (layout.includes("<Analytics")) {
  ok(privacy.includes("Vercel Web Analytics"), "layout.tsx mounts <Analytics />; the Privacy Policy must disclose Vercel Web Analytics");
}
if (layout.includes("<SpeedInsights")) {
  ok(privacy.includes("Speed Insights"), "layout.tsx can mount <SpeedInsights />; the Privacy Policy must disclose it");
}
if (read("src/lib/paymongo.ts").includes("customer_email")) {
  ok(/PayMongo[\s\S]*email address/.test(privacy), "paymongo.ts sends the user's email; the Privacy Policy must say PayMongo receives it");
}
ok(!/xendit/i.test(privacy), "Privacy Policy still names Xendit; billing is PayMongo");

// --- Billing copy matches a prepaid, never-renewing model ------------------------------------------
const billing = read("src/lib/queries/billing.ts");
if (/canManageRenewal\(\)[^{]*\{\s*return false;/.test(billing)) {
  const pages = {
    "src/app/terms/page.tsx": read("src/app/terms/page.tsx"),
    "src/app/page.tsx": read("src/app/page.tsx"),
    "src/app/pricing/page.tsx": pricing,
    "src/components/subscription/promo-offer.tsx": read("src/components/subscription/promo-offer.tsx"),
  };
  for (const [file, text] of Object.entries(pages)) {
    for (const bad of [/turn off (future )?renewal/i, /cancel (any ?time|whenever)/i, /unless cancell?ed/i, /renews at/i]) {
      ok(!bad.test(text), `${file} matches ${bad}, but nothing renews and there is no cancel control (canManageRenewal is false)`);
    }
  }
  ok(pages["src/app/terms/page.tsx"].includes("nothing renews automatically"), "the Terms must still say nothing renews automatically");
}

// --- Downgrade FAQ matches what Free actually allows ---------------------------------------------------
const freeLimits = (read("src/lib/plans.ts").match(/free:\s*\{[\s\S]*?limits:\s*\{([\s\S]*?)\}/) || [])[1];
ok(freeLimits, "plans.ts must define Free limits");
ok(!/fully editable/i.test(pricing), "the /pricing downgrade answer must not promise everything stays fully editable");
if (/netWorth:\s*false/.test(freeLimits)) {
  ok(/net worth/i.test(pricing), "net worth is locked on Free (edits included); the /pricing downgrade answer must say so");
}
if (/csvExport:\s*false/.test(freeLimits)) {
  ok(/CSV/.test(pricing), "CSV import/export is locked on Free; the /pricing downgrade answer must say so");
}

console.log(`public pages contract: ${checks} checks passed`);
