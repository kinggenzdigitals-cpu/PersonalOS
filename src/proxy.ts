import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static assets)
     * - favicon.ico, icons, manifest, and image files
     * - opengraph-image / twitter-image: next/og generates these at routes
     *   with NO file extension, so the image-extension escape never matched
     *   them. They fell through to the auth proxy and 307'd to /login, which
     *   is why link previews for this site rendered nothing.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
