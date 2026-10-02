import type { MetadataRoute } from "next";
import { PRIVACY_UPDATED, TERMS_UPDATED } from "@/lib/legal-dates";
import { getSiteURL } from "@/lib/site";

// lastModified only where a real date exists. The sitemap is built once per
// deploy, so `new Date()` stamped every URL as changed on every deploy — the
// legal pages included, while they still said "Last updated July 2026".
const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
  {
    path: "/privacy",
    priority: 0.3,
    changeFrequency: "yearly" as const,
    lastModified: PRIVACY_UPDATED,
  },
  {
    path: "/terms",
    priority: 0.3,
    changeFrequency: "yearly" as const,
    lastModified: TERMS_UPDATED,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteURL();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${site}${route.path === "/" ? "" : route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}