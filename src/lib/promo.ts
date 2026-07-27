import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActiveOffer = {
  id: string;
  startedAt: string;
  expiresAt: string;
  campaign: string;
};

/**
 * The current user's active (not yet expired) promotional offer, if any.
 * Server time is the source of truth. Tolerant of the table not existing yet.
 */
export async function getActiveOffer(): Promise<ActiveOffer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("promotion_offers")
    .select("id, started_at, expires_at, campaign")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    startedAt: data.started_at,
    expiresAt: data.expires_at,
    campaign: data.campaign,
  };
}
