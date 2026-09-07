"use server";

import { createClient } from "@/lib/supabase/server";

export async function recordAppError(
  digest: string | undefined,
  route: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("record_app_error", {
    p_error_digest: digest ?? "",
    p_route: route,
  });
}
