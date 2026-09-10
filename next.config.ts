import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * Deliberately NO Content-Security-Policy. A correct one here has to enumerate
 * Supabase (the browser talks to it directly), Xendit's hosted invoice
 * redirect, and Next's own inline bootstrap/pre-paint scripts — and a CSP that
 * misses one of those does not degrade, it breaks sign-in or checkout in
 * production with no local symptom. Add it only alongside report-only
 * monitoring that proves the origin list is complete.
 *
 * Strict-Transport-Security is already sent by the platform, so it is not
 * duplicated here.
 */
const securityHeaders = [
  // Stop MIME sniffing turning a user-uploaded or proxied file into script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Financial data on screen — never let another origin frame it (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin only, so a full URL carrying a route never leaks off-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these; deny them rather than rely on defaults.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    // Only hosts actually referenced by the app. The two picsum.photos entries
    // that used to sit here were leftover scaffolding that nothing rendered —
    // an unused remote pattern is a needless widening of what the image
    // optimizer will fetch and then re-serve from this domain.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
