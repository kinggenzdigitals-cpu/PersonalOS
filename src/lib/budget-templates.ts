/**
 * Starter budget templates. A template only *prefills* per-category allotments
 * (and the savings allocation) as a starting point sized to the user's total —
 * the user edits everything afterward. Percentages in each template sum to 1.
 */
import type { Category } from "@/lib/supabase/types";

export type TemplateLine = {
  slot: string; // display label
  matches: string[]; // lowercased substrings matched against category names
  pct: number; // fraction of the overall budget (0–1)
  kind: "category" | "savings";
};

export type BudgetTemplate = {
  id: "essential" | "balanced";
  name: string;
  description: string;
  lines: TemplateLine[];
};

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: "essential",
    name: "Essential",
    description: "Needs-first — covers bills, food and transport, with steady savings.",
    lines: [
      { slot: "Bills", matches: ["bills"], pct: 0.3, kind: "category" },
      { slot: "Food", matches: ["food", "groceries"], pct: 0.25, kind: "category" },
      { slot: "Transportation", matches: ["transport"], pct: 0.12, kind: "category" },
      { slot: "Health", matches: ["health"], pct: 0.08, kind: "category" },
      { slot: "Other", matches: ["other", "misc"], pct: 0.1, kind: "category" },
      { slot: "Savings", matches: [], pct: 0.15, kind: "savings" },
    ],
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "A rounded split across essentials, lifestyle and savings.",
    lines: [
      { slot: "Bills", matches: ["bills"], pct: 0.25, kind: "category" },
      { slot: "Food", matches: ["food", "groceries"], pct: 0.2, kind: "category" },
      { slot: "Transportation", matches: ["transport"], pct: 0.1, kind: "category" },
      { slot: "Shopping", matches: ["shopping"], pct: 0.08, kind: "category" },
      { slot: "Health", matches: ["health"], pct: 0.07, kind: "category" },
      { slot: "Entertainment", matches: ["entertainment", "fun"], pct: 0.07, kind: "category" },
      { slot: "Family", matches: ["family"], pct: 0.05, kind: "category" },
      { slot: "Savings", matches: [], pct: 0.18, kind: "savings" },
    ],
  },
];

/** Find the user's expense category that best matches a template line. */
export function matchTemplateCategory(
  line: TemplateLine,
  expenseCategories: Category[],
): Category | null {
  for (const needle of line.matches) {
    const hit = expenseCategories.find((c) =>
      c.name.toLowerCase().includes(needle),
    );
    if (hit) return hit;
  }
  return null;
}
