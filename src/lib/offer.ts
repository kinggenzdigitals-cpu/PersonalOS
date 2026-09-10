import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LIFETIME_OFFER,
  lifetimeOfferState,
  type LifetimeOfferState,
} from "@/lib/offer-config";

/**
 * How many Founding Lifetime purchases have actually completed.
 *
 * Counts PAID billing_events whose invoice was a lifetime one (external_id
 * carries the `_lifetime_` marker the checkout action sets). This is the honest
 * basis for "N of 100 remaining" — it counts money that actually changed hands,
 * not admin-granted comps and not anyone's guess. billing_events is
 * service-role only, so the count is read here server-side and never exposed.
 *
 * Tolerant by design: if the service-role key or the table is unavailable, the
 * offer must not crash a public page — it degrades to 0 sold (offer open),
 * which is the safe direction for a launch.
 */
export async function getLifetimeSold(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "PAID")
      .like("external_id", "%_lifetime_%");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** The offer's live state: config + real purchase count + the server clock. */
export async function resolveLifetimeOffer(): Promise<
  LifetimeOfferState & { sold: number }
> {
  const sold = await getLifetimeSold();
  const state = lifetimeOfferState({
    active: LIFETIME_OFFER.active,
    maxRedemptions: LIFETIME_OFFER.maxRedemptions,
    sold,
    endsAt: LIFETIME_OFFER.endsAt,
    nowMs: Date.now(),
    launchPriceUSD: LIFETIME_OFFER.launchPriceUSD,
    regularPriceUSD: LIFETIME_OFFER.regularPriceUSD,
  });
  return { ...state, sold };
}
