"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, LifeArea } from "@/lib/supabase/types";

export type OnboardingPayload = {
  displayName: string;
  currency: string;
  accounts: {
    name: string;
    type: AccountType;
    opening_balance: number;
    is_spending: boolean;
  }[];
  habits: { name: string; life_area: LifeArea }[];
};

export type OnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(
  payload: OnboardingPayload,
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You're not signed in." };

  const displayName = payload.displayName.trim();
  if (!displayName) return { ok: false, error: "Please enter your name." };

  const validAccounts = payload.accounts
    .map((a) => ({ ...a, name: a.name.trim() }))
    .filter((a) => a.name.length > 0);

  if (validAccounts.length === 0) {
    return { ok: false, error: "Add at least one account to get started." };
  }

  // 1. Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      currency: payload.currency,
      onboarded: true,
    })
    .eq("user_id", user.id);

  if (profileError) return { ok: false, error: profileError.message };

  // 2. Insert accounts
  const { error: accountsError } = await supabase.from("accounts").insert(
    validAccounts.map((a, i) => ({
      user_id: user.id,
      name: a.name,
      type: a.type,
      opening_balance: a.opening_balance,
      is_spending: a.is_spending,
      sort_order: i,
    })),
  );

  if (accountsError) return { ok: false, error: accountsError.message };

  // 3. Insert selected habits (optional)
  if (payload.habits.length > 0) {
    const { error: habitsError } = await supabase.from("habits").insert(
      payload.habits.map((h, i) => ({
        user_id: user.id,
        name: h.name,
        life_area: h.life_area,
        sort_order: i,
      })),
    );
    if (habitsError) return { ok: false, error: habitsError.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
