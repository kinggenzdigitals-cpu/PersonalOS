import type { MetadataRoute } from "next";

/**
 * The dark `--background` from globals.css, repeated as a literal because the
 * OS reads these two values straight out of the manifest, long before any CSS
 * or the forced-dark <html class="dark"> exists. They used to be the light
 * palette (#FFFFFF / the light brand navy), so every cold launch of the
 * installed PWA flashed a full-screen white splash and then snapped to the
 * dark app — the one light flash the forced theme cannot reach from inside the
 * page. Keep in step with `.dark { --background }`.
 */
const DARK_SURFACE = "#031124";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance & Habit Tracker",
    short_name: "Finance Tracker",
    description:
      "Track your money, habits, mood, tasks, and focus sessions — all in one calm place.",
    start_url: "/home",
    display: "standalone",
    background_color: DARK_SURFACE,
    theme_color: DARK_SURFACE,
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
