import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * Deliberately NO Content-Security-Policy. A correct one here has to enumerate
 * Supabase (the browser talks to it directly), PayMongo's hosted checkout
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
    // No remote hosts: every next/image source is a local file. The
    // picsum.photos and images.unsplash.com entries that used to sit here
    // outlived whatever rendered them — an unused remote pattern is a needless
    // widening of what the image optimizer will fetch and then re-serve from
    // this domain. Give any future entry an explicit `pathname` as well.
    remotePatterns: [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Invite pages print the invitee's email. The page's noindex meta only
      // counts once its HTML is parsed; the header also covers error renders.
      {
        source: "/invite/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
