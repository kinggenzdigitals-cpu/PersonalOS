"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlement";
import { PROMO } from "@/lib/promo-config";

export type ClaimResult = { ok: boolean; error?: string };

/**
 * Create a genuine 12-minute promotional offer for the current user, if
 * eligible and they don't already have an active one. Server-authoritative:
 * expires_at is computed here from server time. Uses the service role so the
 * user can't mint or extend their own offer.
 */
export async function claimOffer(): Promise<ClaimResult> {
  const ent = await getEntitlement();
  // Premium / Super Admin / complimentary / lifetime are not eligible.
  if (
    !ent.userId ||
    ent.isSuperAdmin ||
    ent.plan === "premium" ||
    ent.accessType != null
  ) {
    return { ok: false, error: "You're not eligible for this offer." };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Don't duplicate an active offer.
  const { data: existing } = await admin
    .from("promotion_offers")
    .select("id")
    .eq("user_id", ent.userId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (existing) {
    revalidatePath("/subscription");
    return { ok: true };
  }

  const expiresAt = new Date(
    Date.now() + PROMO.minutes * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("promotion_offers").insert({
    user_id: ent.userId,
    campaign: PROMO.campaign,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: "Couldn't start the offer." };

  revalidatePath("/subscription");
  return { ok: true };
}
