import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Uptime probe. "/" keeps answering 200 while Supabase is down or paused (the
 * landing page swallows its database errors), so a monitor on it can't see an
 * outage. This makes one cheap round-trip through PostgREST to Postgres and
 * answers 503 when that fails or takes longer than 3 seconds.
 *
 * Public (see PUBLIC_PATHS) and says nothing else on purpose: no version, no
 * error text, no env. With no session the query sees zero rows under RLS,
 * which is fine — reaching the database is the whole check.
 */
export async function GET() {
  let ok = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("categories")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    ok = !error;
  } catch {
    ok = false;
  }

  const response = NextResponse.json({ ok }, { status: ok ? 200 : 503 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
