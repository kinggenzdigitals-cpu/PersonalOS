"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/supabase/errors";
import { hasProFeature } from "@/lib/plan-guard";
import type { AssetKind, LiabilityKind } from "@/lib/supabase/types";

const PRO_REQUIRED =
  "Net worth tracking is a Pro feature. Upgrade to add assets & liabilities.";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function auth() {
  // requireActiveUser() is null for a suspended / revoked account as well as a
  // signed-out one, so callers refuse the write either way.
  const active = await requireActiveUser();
  if (active) return active;
  return { supabase: await createClient(), user: null };
}

function revalidate() {
  revalidatePath("/", "layout");
}

// ---- Assets --------------------------------------------------------------

export async function upsertAsset(input: {
  id?: string;
  name: string;
  kind: AssetKind;
  value: number;
  notes?: string | null;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(await hasProFeature("netWorth"))) {
    return { ok: false, error: PRO_REQUIRED };
  }
  if (!input.name.trim()) return { ok: false, error: "Name the asset." };
  if (!(input.value >= 0)) return { ok: false, error: "Enter a value." };

  const row = {
    name: input.name.trim(),
    kind: input.kind,
    value: input.value,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("assets")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this asset.") };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this asset.") };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't delete this asset.") };
  revalidate();
  return { ok: true };
}

// ---- Liabilities ---------------------------------------------------------

export async function upsertLiability(input: {
  id?: string;
  name: string;
  kind: LiabilityKind;
  balance: number;
  notes?: string | null;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(await hasProFeature("netWorth"))) {
    return { ok: false, error: PRO_REQUIRED };
  }
  if (!input.name.trim()) return { ok: false, error: "Name the liability." };
  if (!(input.balance >= 0)) return { ok: false, error: "Enter a balance." };

  const row = {
    name: input.name.trim(),
    kind: input.kind,
    balance: input.balance,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("liabilities")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this liability.") };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("liabilities")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this liability.") };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteLiability(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("liabilities").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't delete this liability.") };
  revalidate();
  return { ok: true };
}
