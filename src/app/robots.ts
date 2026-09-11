import type { MetadataRoute } from "next";
import { getSiteURL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteURL();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/privacy", "/terms"],
        disallow: [
          "/account",
          "/admin",
          "/calendar",
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
          "/invite/",
          "/onboarding",
          "/suspended",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}