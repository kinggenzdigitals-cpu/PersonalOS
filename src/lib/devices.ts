import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissing } from "@/lib/supabase/errors";
import type { AccountDevice } from "@/lib/supabase/types";

export const DEVICE_COOKIE = "fht_device";
export const MAX_ACTIVE_DEVICES = 2;

export type DeviceInfo = AccountDevice & { current: boolean };

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function deviceNameFromUserAgent(userAgent: string | null) {
  const ua = userAgent ?? "";
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Safari/")
        ? "Safari"
        : ua.includes("Firefox/")
          ? "Firefox"
          : "Browser";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua)
    ? "mobile"
    : "desktop";
  return `${browser} on ${device}`;
}

export async function getDeviceCookieHash() {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  return token ? hashDeviceToken(token) : null;
}

/**
 * The device limit fails open when it can't be checked (turning that into a
 * lockout is an owner decision), so at least say so in the logs. Fixed reasons
 * and error codes only: nothing about the user.
 */
function logLimitSkipped(reason: string, code?: string) {
  console.error(`[devices] device limit NOT enforced: ${reason}`, code ?? "");
}

export async function enforceCurrentDevice(userId: string) {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    logLimitSkipped("service-role client unavailable (SUPABASE_SERVICE_ROLE_KEY missing)");
    return;
  }

  const currentHash = await getDeviceCookieHash();
  if (!currentHash) redirect("/api/devices/register");

  const { data: current, error } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("user_id", userId)
    .eq("device_token_hash", currentHash)
    .maybeSingle<{ id: string; revoked_at: string | null }>();

  if (error) {
    if (isSchemaMissing(error)) {
      logLimitSkipped("account_devices table missing (apply migration 0025)");
      return;
    }
    redirect("/api/devices/register");
  }

  if (!current || current.revoked_at) redirect("/api/devices/register");

  const { count, error: countError } = await admin
    .from("account_devices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (countError) logLimitSkipped("active-device count failed", countError.code);
  if (!countError && (count ?? 0) > MAX_ACTIVE_DEVICES) {
    redirect("/device-limit");
  }

  await admin
    .from("account_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("user_id", userId);
}

export async function listCurrentUserDevices(): Promise<DeviceInfo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const currentHash = await getDeviceCookieHash();
  const { data, error } = await supabase
    .from("account_devices")
    .select("*")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error && isSchemaMissing(error)) return [];
  if (error) return [];

  return ((data as AccountDevice[] | null) ?? []).map((device) => ({
    ...device,
    current: Boolean(currentHash && device.device_token_hash === currentHash),
  }));
}

export async function registerCurrentDevice(nextPath = "/home") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    logLimitSkipped("service-role client unavailable (SUPABASE_SERVICE_ROLE_KEY missing)");
    redirect(nextPath);
  }

  const jar = await cookies();
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const existingToken = jar.get(DEVICE_COOKIE)?.value;
  const token = existingToken || newDeviceToken();
  const tokenHash = hashDeviceToken(token);
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("user_id", user.id)
    .eq("device_token_hash", tokenHash)
    .maybeSingle<{ id: string; revoked_at: string | null }>();

  if (existingError && isSchemaMissing(existingError)) {
    logLimitSkipped("account_devices table missing (apply migration 0025)");
    redirect(nextPath);
  }

  // A removed device stays removed. Reviving its row here let a removed
  // browser walk straight back in on its next page load whenever a slot was
  // free. End its session instead: scope "local" revokes this browser's session
  // on the auth server, not just its cookies. The device cookie goes too, so
  // the owner can sign in here again later as a new device.
  if (existing?.revoked_at) {
    await supabase.auth.signOut({ scope: "local" });
    jar.delete(DEVICE_COOKIE);
    redirect("/login?signedOut=1");
  }

  if (existing && !existing.revoked_at) {
    await admin
      .from("account_devices")
      .update({ last_seen_at: now, user_agent: userAgent })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    jar.set(DEVICE_COOKIE, token, deviceCookieOptions());
    redirect(nextPath);
  }

  const { count, error: countError } = await admin
    .from("account_devices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (countError) logLimitSkipped("active-device count failed", countError.code);
  if (!countError && (count ?? 0) >= MAX_ACTIVE_DEVICES) {
    redirect("/device-limit?blocked=1");
  }

  // No `revoked_at` here: if this ever lands on a revoked row, it stays revoked.
  const { error: upsertError } = await admin.from("account_devices").upsert(
    {
      user_id: user.id,
      device_token_hash: tokenHash,
      name: deviceNameFromUserAgent(userAgent),
      user_agent: userAgent,
      last_seen_at: now,
    },
    { onConflict: "user_id,device_token_hash" },
  );

  if (upsertError && !isSchemaMissing(upsertError)) {
    redirect("/device-limit?blocked=1");
  }

  jar.set(DEVICE_COOKIE, token, deviceCookieOptions());
  redirect(nextPath);
}

/**
 * Runs right after a successful sign-in. A removed browser keeps its device
 * cookie, and registerCurrentDevice signs a revoked token out: right for a
 * session that outlived the removal, but it bounced a fresh sign-in straight
 * back to /login. Fresh credentials make this a new device, so drop the revoked
 * token and let the next request register one (still under the device limit).
 * This grants nothing a browser couldn't get by deleting its own cookie.
 */
export async function forgetRevokedDeviceCookie(userId: string) {
  const currentHash = await getDeviceCookieHash();
  if (!currentHash) return;

  const { data } = await createAdminClient()
    .from("account_devices")
    .select("revoked_at")
    .eq("user_id", userId)
    .eq("device_token_hash", currentHash)
    .maybeSingle<{ revoked_at: string | null }>();

  if (data?.revoked_at) (await cookies()).delete(DEVICE_COOKIE);
}

export function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}