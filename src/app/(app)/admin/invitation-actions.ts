"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireSuperAdmin,
  isOwnerEmail,
  provisionalAdminBlock,
} from "@/lib/entitlement";
import { getSiteURL } from "@/lib/site";
import type { AccessType } from "@/lib/supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

export type InviteResult =
  | { ok: true; message: string; link?: string; existing?: boolean }
  | { ok: false; error: string };

function newToken() {
  const token = randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function findUserByEmail(admin: Admin, email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (
    data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ??
    null
  );
}

async function applyComplimentary(
  admin: Admin,
  userId: string,
  selectedPlan: string,
  accessType: AccessType,
  expiresAt: string | null,
  grantedBy: string | null,
) {
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: selectedPlan,
      status: "active",
      interval: accessType === "lifetime_pro" ? "lifetime" : "invite_grant",
      billing_period: accessType === "lifetime_pro" ? "lifetime" : "invite_grant",
      current_period_start: new Date().toISOString(),
      current_period_end: accessType === "lifetime_pro" ? null : expiresAt,
      access_type: accessType,
      access_expires_at: expiresAt,
      amount_paid: 0,
      promo_code_id: null,
      promo_code: null,
      cancel_at_period_end: true,
      canceled_at: null,
      granted_by: grantedBy,
    },
    { onConflict: "user_id" },
  );
}

async function audit(
  admin: Admin,
  adminId: string,
  target: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await admin
    .from("admin_audit_log")
    .insert({ admin_id: adminId, target_user_id: target, action, detail });
}

/** Invite an email to complimentary Pro/Premium. Applies immediately if they
 *  already have an account; otherwise creates a pending, tokenized invitation. */
export async function createInvitation(input: {
  email: string;
  fullName: string;
  selectedPlan: "pro" | "premium";
  expiresAt: string | null; // null = no expiration
  message?: string;
}): Promise<InviteResult> {
  const me = await requireSuperAdmin();
  // Invitations mint credentials — permanent administrators only.
  const limited = provisionalAdminBlock(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  // An invitation for an existing account doubles as a password-reset primitive
  // (see acceptInvitation), so it must never target the owner allow-list.
  if (isOwnerEmail(email)) {
    return {
      ok: false,
      error: "That address is on the owner allow-list and can't be invited.",
    };
  }

  // Existing account → apply the complimentary plan directly.
  const existing = await findUserByEmail(admin, email);
  if (existing) {
    await applyComplimentary(
      admin,
      existing.id,
      input.selectedPlan,
      "complimentary_pro",
      input.expiresAt,
      me.userId,
    );
    await admin.from("user_invitations").insert({
      email,
      full_name: input.fullName.trim() || null,
      selected_plan: input.selectedPlan,
      access_type: "complimentary_pro",
      access_expires_at: input.expiresAt,
      token_hash: newToken().hash,
      invitation_expires_at: new Date().toISOString(),
      status: "accepted",
      invited_by: me.userId,
      accepted_by: existing.id,
      accepted_at: new Date().toISOString(),
    });
    await audit(admin, me.userId!, existing.id, "invite_existing_applied", {
      email,
      selectedPlan: input.selectedPlan,
    });
    revalidatePath("/admin");
    return {
      ok: true,
      existing: true,
      message: `${email} already has an account — complimentary ${input.selectedPlan} applied.`,
    };
  }

  // Prevent duplicate pending invitations.
  const { data: dup } = await admin
    .from("user_invitations")
    .select("id")
    .ilike("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (dup) {
    return { ok: false, error: "A pending invitation already exists for this email." };
  }

  const { token, hash } = newToken();
  const invitationExpires = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("user_invitations").insert({
    email,
    full_name: input.fullName.trim() || null,
    selected_plan: input.selectedPlan,
    access_type: "complimentary_pro",
    access_expires_at: input.expiresAt,
    token_hash: hash,
    invitation_expires_at: invitationExpires,
    status: "pending",
    invited_by: me.userId,
  });
  if (error) return { ok: false, error: error.message };

  await audit(admin, me.userId!, null, "invite_created", {
    email,
    selectedPlan: input.selectedPlan,
  });
  revalidatePath("/admin");
  return {
    ok: true,
    link: `${getSiteURL()}/invite/${token}`,
    message: "Email delivery is not configured — copy the invitation link below.",
  };
}

export async function resendInvitation(id: string): Promise<InviteResult> {
  const me = await requireSuperAdmin();
  const limited = provisionalAdminBlock(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();

  // Only a still-pending invitation may be re-issued. Re-opening an ACCEPTED
  // one minted a fresh token for an account that already exists, and
  // acceptInvitation resets an existing account's password — so this was a
  // route to take over any user, including the owner. The UI hid the button for
  // accepted rows, but the server action is directly invocable.
  const { data: inv } = await admin
    .from("user_invitations")
    .select("status, email")
    .eq("id", id)
    .maybeSingle<{ status: string; email: string }>();
  if (!inv) return { ok: false, error: "Invitation not found." };
  if (inv.status !== "pending") {
    return {
      ok: false,
      error: `That invitation is ${inv.status} and can't be resent. Create a new one instead.`,
    };
  }
  if (isOwnerEmail(inv.email)) {
    return { ok: false, error: "That address can't be invited." };
  }

  const { token, hash } = newToken();
  const { error } = await admin
    .from("user_invitations")
    .update({
      token_hash: hash,
      status: "pending",
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  await audit(admin, me.userId!, null, "invite_resent", { id });
  revalidatePath("/admin");
  return {
    ok: true,
    link: `${getSiteURL()}/invite/${token}`,
    message: "New invitation link generated.",
  };
}

export async function revokeInvitation(id: string): Promise<InviteResult> {
  const me = await requireSuperAdmin();
  const limited = provisionalAdminBlock(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("user_invitations")
    .select("accepted_by")
    .eq("id", id)
    .maybeSingle<{ accepted_by: string | null }>();

  const { error } = await admin
    .from("user_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // If already accepted, also revoke the complimentary access.
  if (inv?.accepted_by) {
    await admin
      .from("subscriptions")
      .update({ access_type: null, access_expires_at: null })
      .eq("user_id", inv.accepted_by);
  }
  await audit(admin, me.userId!, inv?.accepted_by ?? null, "invite_revoked", {
    id,
  });
  revalidatePath("/admin");
  return { ok: true, message: "Invitation revoked." };
}
