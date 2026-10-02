import type { MetadataRoute } from "next";
import { getSiteURL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteURL();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/privacy", "/terms"],
        // /invite/ and the (auth) pages are deliberately NOT listed: they
        // carry a noindex meta, which a crawler only reads if it is allowed
        // to fetch the page. A disallowed URL can still be indexed bare.
        disallow: [
          "/account",
          "/admin",
          "/calendar",
          "/change-password",
          "/device-limit",
          "/feedback",
          "/focus",
          "/habits",
          "/home",
          "/money",
          "/reports",
          "/settings",
          "/subscription",
          "/tasks",
          "/api/",
          "/auth/",
          "/onboarding",
          "/suspended",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}