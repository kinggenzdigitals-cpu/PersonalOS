"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import { isSchemaMissing } from "@/lib/supabase/errors";
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
  /** Optional finance setup — any of these may be skipped. */
  monthlyBudget?: number | null;
  savingsTarget?: number | null;
  savingsGoal?: { name: string; targetAmount: number } | null;
};

export type OnboardingResult = { ok: true } | { ok: false; error: string };

function toMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

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

  // 1. Accounts FIRST. The `onboarded` flag is flipped last, so a failure here
  //    leaves the user in the wizard rather than stranding them in an empty app.
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

  // 2. Selected habits (optional)
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

  // 3. Monthly budget + savings allocation (optional, skippable)
  const budget = payload.monthlyBudget ?? 0;
  const savings = payload.savingsTarget ?? 0;
  if (budget > 0) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle<{ timezone: string }>();
    const tz = profileRow?.timezone ?? "Asia/Manila";
    const periodStart = `${localDateKey(tz).slice(0, 7)}-01`;

    const { error: budgetError } = await supabase.from("monthly_budgets").upsert(
      {
        user_id: user.id,
        period_start: periodStart,
        total_amount: toMoney(budget),
        savings_target: toMoney(Math.max(0, Math.min(savings, budget))),
      },
      { onConflict: "user_id,period_start" },
    );
    // Tolerate the table not existing yet (migration 0011 not applied).
    if (budgetError && !isSchemaMissing(budgetError)) {
      return { ok: false, error: budgetError.message };
    }
  }

  // 4. First savings goal (optional, skippable)
  const goal = payload.savingsGoal;
  if (goal && goal.name.trim() && goal.targetAmount > 0) {
    const { error: goalError } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: goal.name.trim(),
      target_amount: toMoney(goal.targetAmount),
      saved_amount: 0,
    });
    if (goalError && !isSchemaMissing(goalError)) {
      return { ok: false, error: goalError.message };
    }
  }

  // 5. Finally mark the profile onboarded.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      currency: payload.currency,
      onboarded: true,
    })
    .eq("user_id", user.id);
  if (profileError) return { ok: false, error: profileError.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
