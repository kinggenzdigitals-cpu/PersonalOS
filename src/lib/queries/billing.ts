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
 * The plan to gate features on. 'pro' only when the subscription is active AND
 * the paid period hasn't lapsed (billing is invoice-based, so access is granted
 * per period rather than auto-renewed). A null period end means no expiry
 * (e.g. a manually comped account).
 */
export async function getActivePlan(): Promise<PlanId> {
  const sub = await getSubscription();
  if (!sub || sub.plan !== "pro" || sub.status !== "active") return "free";
  if (sub.current_period_end) {
    const notExpired = new Date(sub.current_period_end).getTime() > Date.now();
    if (!notExpired) return "free";
  }
  return "pro";
}
