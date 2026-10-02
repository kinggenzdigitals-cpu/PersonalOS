import type { Metadata } from "next";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/**
 * Open Graph fields every public page repeats. Next replaces `openGraph`
 * wholesale per segment rather than merging it with the layout's, so a page
 * that sets its own og:title drops the site name and locale unless it spreads
 * these back in.
 */
export const BASE_OPEN_GRAPH = {
  siteName: "Finance & Habit Tracker",
  locale: "en_US",
  type: "website",
} satisfies OpenGraph;

/**
 * The root opengraph-image.tsx, named explicitly. Only app/page.tsx sits beside
 * that file, so it is the only page Next re-attaches the image to after the
 * page overrides `openGraph`; any other page that overrides it loses og:image
 * and twitter:image unless it lists this. Not for app/page.tsx: an explicit
 * `images` there would stop the colocated file supplying its own URL.
 */
export const SHARED_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Finance & Habit Tracker — your whole life, in one calm place",
};
