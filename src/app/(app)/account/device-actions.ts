"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE, hashDeviceToken } from "@/lib/devices";
import { isSchemaMissing } from "@/lib/supabase/errors";

export type DeviceActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function removeDevice(deviceId: string): Promise<DeviceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const admin = createAdminClient();
  const jar = await cookies();
  const currentToken = jar.get(DEVICE_COOKIE)?.value;
  const currentHash = currentToken ? hashDeviceToken(currentToken) : null;

  const { data: device, error: lookupError } = await admin
    .from("account_devices")
    .select("id, device_token_hash")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; device_token_hash: string }>();

  if (lookupError) {
    if (isSchemaMissing(lookupError)) {
      return { ok: false, error: "Device management is not migrated yet." };
    }
    return { ok: false, error: lookupError.message };
  }
  if (!device) return { ok: false, error: "Device not found." };

  const { error } = await admin
    .from("account_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  if (currentHash && device.device_token_hash === currentHash) {
    jar.delete(DEVICE_COOKIE);
  }

  revalidatePath("/account");
  revalidatePath("/device-limit");
  return { ok: true, message: "Device removed." };
}