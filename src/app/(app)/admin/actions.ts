"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireSuperAdmin,
  isOwnerEmail,
  provisionalAdminBlock,
  type Entitlement,
} from "@/lib/entitlement";
import { STATUS_ORDER } from "@/lib/feedback";
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

/**
 * Refuses admin actions aimed at another administrator or at an owner-allow-list
 * address.
 *
 * Without this, any super admin — including one auto-granted from the email
 * allow-list, whose access is meant to be withdrawable — could call
 * `resetPassword` on the platform owner, read the temporary password out of the
 * result, and sign in as a permanent administrator. Removing their own address
 * from the allow-list would then revoke nothing. It is also a denial-of-service
 * against the owner's own account.
 */
/**
 * Defence in depth: only a permanent administrator may run actions that mint
 * credentials, grant paid access, or change account state. A provisional
 * (allow-list) admin gets read + feedback triage.
 *
 * This is a second line behind guardPrivilegedTarget below: even if some future
 * action forgets its target check, a withdrawable grant cannot reach it.
 */
function guardPrivilegedActor(ent: Entitlement): string | null {
  return provisionalAdminBlock(ent);
}

async function guardPrivilegedTarget(
  admin: Admin,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();
  if (profile?.role === "super_admin") {
    return "That account is an administrator. Change its role in the database first.";
  }

  const { data: target } = await admin.auth.admin.getUserById(userId);
  if (isOwnerEmail(target?.user?.email)) {
    return "That address is on the owner allow-list and can't be modified here.";
  }
  return null;
}

/** Suspend / reactivate / revoke an account. Revoking also drops comp access. */
export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  const limited = guardPrivilegedActor(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();

  const blocked = await guardPrivilegedTarget(admin, userId);
  if (blocked) return { ok: false, error: blocked };

  const { error } = await admin
    .from("profiles")
    .update({ status })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (status === "revoked") {
    // Clear the period too. Leaving a future current_period_end behind meant a
    // later payment stacked the revoked remainder on top of the new purchase,
    // handing back access an admin had deliberately removed.
    await admin
      .from("subscriptions")
      .update({
        access_type: null,
        access_expires_at: null,
        plan: "free",
        status: "canceled",
        current_period_end: null,
      })
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
  const limited = guardPrivilegedActor(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();

  const blocked = await guardPrivilegedTarget(admin, userId);
  if (blocked) return { ok: false, error: blocked };

  if (accessType === null) {
    // Remove complimentary/lifetime grant → back to Free, unless they have a
    // genuinely paid period still running, which we leave untouched.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle<{ current_period_end: string | null }>();

    const paidPeriodLive =
      !!existing?.current_period_end &&
      new Date(existing.current_period_end).getTime() > Date.now();

    // Grants are written with plan 'pro'/'premium' + status 'active' and no
    // period. Clearing only access_type would leave exactly that shape behind,
    // which reads as an active paid plan everywhere.
    const { error } = await admin
      .from("subscriptions")
      .update(
        paidPeriodLive
          ? { access_type: null, access_expires_at: null }
          : {
              access_type: null,
              access_expires_at: null,
              plan: "free",
              status: "inactive",
            },
      )
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
  const limited = guardPrivilegedActor(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();

  // Resetting an administrator's password would hand the caller that account.
  const blocked = await guardPrivilegedTarget(admin, userId);
  if (blocked) return { ok: false, error: blocked };

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
  const limited = guardPrivilegedActor(me);
  if (limited) return { ok: false, error: limited };
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (!email || !username) {
    return { ok: false, error: "Email and username are required." };
  }
  // Creating an account at an allow-list address would auto-grant it super
  // admin on first sign-in — with the creator holding the temp password.
  if (isOwnerEmail(email)) {
    return {
      ok: false,
      error: "That address is on the owner allow-list and can't be created here.",
    };
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

  // Triage stays open to provisional admins, so bound what it can write.
  // `admin_response` is rendered to the submitter as an official reply from the
  // platform, and unbounded text here is content injection under our voice.
  const MAX = 4000;
  if ((patch.adminNote?.length ?? 0) > MAX) {
    return { ok: false, error: "That note is too long." };
  }
  if ((patch.adminResponse?.length ?? 0) > MAX) {
    return { ok: false, error: "That response is too long." };
  }
  if (patch.status !== undefined && !STATUS_ORDER.includes(patch.status)) {
    return { ok: false, error: "Unknown feedback status." };
  }

  const row: Partial<Feedback> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
  if (patch.adminResponse !== undefined) row.admin_response = patch.adminResponse;
  if (patch.isDuplicate !== undefined) row.is_duplicate = patch.isDuplicate;
  if (patch.archived !== undefined) row.archived = patch.archived;

  const { error } = await admin.from("feedback").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Record WHICH fields changed, not their caller-controlled values — spreading
  // `patch` let an admin write unbounded JSON into the audit trail.
  await audit(admin, me.userId!, null, "update_feedback", {
    id,
    fields: Object.keys(row),
    status: patch.status ?? null,
  });
  revalidatePath("/admin");
  return { ok: true, message: "Feedback updated." };
}
