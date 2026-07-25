"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssetKind, LiabilityKind } from "@/lib/supabase/types";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
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
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
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
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("liabilities")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteLiability(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("liabilities").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
