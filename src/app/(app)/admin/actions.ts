"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/entitlement";
import type {
  AccessType,
  AccountStatus,
  Feedback,
  FeedbackStatus,
} from "@/lib/supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

async function audit(
  admin: Admin,
  adminId: string,
  targetUserId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await admin
    .from("admin_audit_log")
    .insert({ admin_id: adminId, target_user_id: targetUserId, action, detail });
}

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

/** Suspend / reactivate / revoke an account. Revoking also drops comp access. */
export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ status })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (status === "revoked") {
    await admin
      .from("subscriptions")
      .update({ access_type: null, plan: "free", status: "canceled" })
      .eq("user_id", userId);
  }

  await audit(admin, me.userId!, userId, `account_${status}`);
  revalidatePath("/admin");
  return { ok: true, message: `Account ${status}.` };
}

/** Grant / change / remove complimentary or lifetime Pro. */
export async function setAccess(
  userId: string,
  accessType: AccessType | null,
  expiresAt: string | null,
): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();

  if (accessType === null) {
    // Remove complimentary/lifetime grant → back to free (unless they have a
    // real paid subscription, which we leave untouched).
    const { error } = await admin
      .from("subscriptions")
      .update({ access_type: null, access_expires_at: null })
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: "pro",
        status: "active",
        access_type: accessType,
        access_expires_at: accessType === "lifetime_pro" ? null : expiresAt,
        granted_by: me.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  await audit(admin, me.userId!, userId, "set_access", {
    accessType,
    expiresAt,
  });
  revalidatePath("/admin");
  return { ok: true, message: "Access updated." };
}

function tempPassword(): string {
  const rand = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Fht-${rand}`;
}

/**
 * Reset a user's password to a temporary one and force a change on next login.
 * Returns the temp password to show the admin once (never stored in plain text
 * beyond the auth provider's own hashing).
 */
export async function resetPassword(userId: string): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();
  const temp = tempPassword();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: temp,
  });
  if (error) return { ok: false, error: error.message };

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);
  await audit(admin, me.userId!, userId, "reset_password");
  revalidatePath("/admin");
  return { ok: true, message: `Temporary password: ${temp}` };
}

/** Create a complimentary/lifetime Pro account (no payment). */
export async function createComplimentaryAccount(input: {
  email: string;
  fullName: string;
  username: string;
  accessType: Exclude<AccessType, "paid">;
  expiresAt: string | null;
}): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (!email || !username) {
    return { ok: false, error: "Email and username are required." };
  }

  // Enforce case-insensitive unique username.
  const { data: clash } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .maybeSingle();
  if (clash) return { ok: false, error: "That username is already taken." };

  const temp = tempPassword();
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password: temp,
      email_confirm: true,
      user_metadata: { full_name: input.fullName.trim() },
    });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? "Couldn't create user." };
  }
  const uid = created.user.id;

  await admin.from("profiles").upsert(
    {
      user_id: uid,
      display_name: input.fullName.trim() || null,
      username,
      role: "user",
      status: "active",
      onboarded: true,
      must_change_password: true,
    },
    { onConflict: "user_id" },
  );

  await admin.from("subscriptions").upsert(
    {
      user_id: uid,
      plan: "pro",
      status: "active",
      access_type: input.accessType,
      access_expires_at:
        input.accessType === "lifetime_pro" ? null : input.expiresAt,
      granted_by: me.userId,
    },
    { onConflict: "user_id" },
  );

  await audit(admin, me.userId!, uid, "create_complimentary", {
    email,
    username,
    accessType: input.accessType,
  });
  revalidatePath("/admin");
  return { ok: true, message: `Account created. Temporary password: ${temp}` };
}

/** Triage a feedback item (status / internal note / user response). */
export async function updateFeedback(
  id: string,
  patch: {
    status?: FeedbackStatus;
    adminNote?: string;
    adminResponse?: string;
    isDuplicate?: boolean;
    archived?: boolean;
  },
): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();

  const row: Partial<Feedback> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
  if (patch.adminResponse !== undefined) row.admin_response = patch.adminResponse;
  if (patch.isDuplicate !== undefined) row.is_duplicate = patch.isDuplicate;
  if (patch.archived !== undefined) row.archived = patch.archived;

  const { error } = await admin.from("feedback").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await audit(admin, me.userId!, null, "update_feedback", { id, ...patch });
  revalidatePath("/admin");
  return { ok: true, message: "Feedback updated." };
}
