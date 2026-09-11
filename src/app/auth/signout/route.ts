import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  const response = NextResponse.redirect(new URL("/login?signedOut=1", request.url), {
    status: 303,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
