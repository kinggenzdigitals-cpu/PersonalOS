import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/plans";
import type { Subscription } from "@/lib/supabase/types";

/**
 * The current user's subscription, if any. Returns null when the table doesn't
 * exist yet (billing migration not applied) or there's no row.
 */
export async function getSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Subscription>();

  // 42P01 = table missing (migration not applied) → treat as no subscription.
  if (error && error.code !== "42P01") return null;
  return data ?? null;
}

/**
 * Whether cancelling or resuming renewal means anything for the signed-in
 * user. Today it never does: every paid period is a one-off PayMongo checkout
 * with no stored payment method, so nothing renews and there is nothing to
 * switch off. (The previous gate required a Xendit recurring-plan id that the
 * webhook never wrote, so it was already always false — this says so plainly
 * instead of depending on a provider column.) Return true here only once a
 * provider-side recurring plan actually exists.
 */
export async function canManageRenewal(): Promise<boolean> {
  return false;
}

/**
 * The plan to gate features on. Delegates to the server-side entitlement engine
 * so super_admin / lifetime / complimentary access is honored (not just paid
 * subscriptions).
 */
export async function getActivePlan(): Promise<PlanId> {
  const { getEntitlement } = await import("@/lib/entitlement");
  return (await getEntitlement()).plan;
}
