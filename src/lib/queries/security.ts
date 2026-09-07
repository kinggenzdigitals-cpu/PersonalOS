import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SecurityEvent } from "@/lib/supabase/types";

export type SecurityHistory = {
  available: boolean;
  events: SecurityEvent[];
};

export async function getSecurityHistory(): Promise<SecurityHistory> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { available: false, events: [] };
  return { available: true, events: data ?? [] };
}
