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

export async function enforceCurrentDevice(userId: string) {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
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
    if (isSchemaMissing(error)) return;
    redirect("/api/devices/register");
  }

  if (!current || current.revoked_at) redirect("/api/devices/register");

  const { count, error: countError } = await admin
    .from("account_devices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

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

  if (existingError && isSchemaMissing(existingError)) redirect(nextPath);

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

  if (!countError && (count ?? 0) >= MAX_ACTIVE_DEVICES) {
    redirect("/device-limit?blocked=1");
  }

  const { error: upsertError } = await admin.from("account_devices").upsert(
    {
      user_id: user.id,
      device_token_hash: tokenHash,
      name: deviceNameFromUserAgent(userAgent),
      user_agent: userAgent,
      last_seen_at: now,
      revoked_at: null,
    },
    { onConflict: "user_id,device_token_hash" },
  );

  if (upsertError && !isSchemaMissing(upsertError)) {
    redirect("/device-limit?blocked=1");
  }

  jar.set(DEVICE_COOKIE, token, deviceCookieOptions());
  redirect(nextPath);
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