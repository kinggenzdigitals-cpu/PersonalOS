"use server";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/entitlement";
import type { Invitation } from "@/lib/supabase/types";

export type AcceptResult = { ok: true } | { ok: false; error: string };

/** Accept a tokenized invitation: create the account (or reuse it), apply the
 *  complimentary plan, and mark the invitation accepted. Service-role only. */
export async function acceptInvitation(
  token: string,
  password: string,
): Promise<AcceptResult> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const admin = createAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");

  const { data: inv } = await admin
    .from("user_invitations")
    .select("*")
    .eq("token_hash", hash)
    .eq("status", "pending")
    .maybeSingle<Invitation>();
  if (!inv) {
    return { ok: false, error: "This invitation is invalid or already used." };
  }
  if (new Date(inv.invitation_expires_at).getTime() < Date.now()) {
    await admin
      .from("user_invitations")
      .update({ status: "expired" })
      .eq("id", inv.id);
    return { ok: false, error: "This invitation has expired." };
  }

  const email = inv.email;

  // Belt and braces: never honour an invitation aimed at an owner-allow-list
  // address, however the row was minted. The create-time check upstream can be
  // bypassed (rows predating it, or an address allow-listed after the fact).
  if (isOwnerEmail(email)) {
    return { ok: false, error: "This invitation can't be used." };
  }

  // CREATE-ONLY. This endpoint is UNAUTHENTICATED — anyone holding a token
  // reaches it. The old fallback "email already exists → set the chosen
  // password" turned any invitation row into an arbitrary password reset for
  // an existing account, so minting a row for someone else's address (via the
  // admin UI, or straight through PostgREST under the admin RLS policy) was a
  // full account takeover. An invitation may only ever create a NEW account.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: inv.full_name },
    },
  );
  if (createErr || !created?.user) {
    return {
      ok: false,
      error:
        "An account already exists for this address. Sign in instead — an invitation can't change an existing account's password.",
    };
  }
  const uid = created.user.id;

  await admin
    .from("profiles")
    .upsert(
      { user_id: uid, display_name: inv.full_name, onboarded: true },
      { onConflict: "user_id" },
    );
  await admin.from("subscriptions").upsert(
    {
      user_id: uid,
      plan: inv.selected_plan,
      status: "active",
      access_type: inv.access_type,
      access_expires_at: inv.access_expires_at,
      granted_by: inv.invited_by,
    },
    { onConflict: "user_id" },
  );
  await admin
    .from("user_invitations")
    .update({
      status: "accepted",
      accepted_by: uid,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  if (inv.invited_by) {
    await admin.from("admin_audit_log").insert({
      admin_id: inv.invited_by,
      target_user_id: uid,
      action: "invite_accepted",
      detail: { email },
    });
  }

  return { ok: true };
}
