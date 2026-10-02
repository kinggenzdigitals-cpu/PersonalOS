"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/lib/auth";
import { friendlyDbError, isSchemaMissing } from "@/lib/supabase/errors";

export type DeviceActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function removeDevice(deviceId: string): Promise<DeviceActionResult> {
  // The writes below use the service role, so RLS can't refuse a suspended
  // account here; this check does.
  const active = await requireActiveUser();
  if (!active) return { ok: false, error: "You're not signed in." };
  const { user } = active;

  const admin = createAdminClient();

  const { data: device, error: lookupError } = await admin
    .from("account_devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (lookupError) {
    if (isSchemaMissing(lookupError)) {
      return { ok: false, error: "Device management is not migrated yet." };
    }
    return { ok: false, error: friendlyDbError(lookupError, "Couldn't look up that device.") };
  }
  if (!device) return { ok: false, error: "Device not found." };

  const { error } = await admin
    .from("account_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't remove that device.") };

  // The device cookie is left alone, even when this is the caller's own
  // browser: its next request finds the revoked row and registerCurrentDevice
  // signs it out. Deleting the cookie let it re-register as a "new" device.

  revalidatePath("/account");
  revalidatePath("/device-limit");
  return { ok: true, message: "Device removed." };
}