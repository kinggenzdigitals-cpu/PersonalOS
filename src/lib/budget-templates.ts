export type BudgetTemplateId =
  | "simple"
  | "essentials"
  | "balanced"
  | "flexible";

export type BudgetTemplate = {
  id: BudgetTemplateId;
  name: string;
  description: string;
  savingsPercent: number;
  categories: { name: string; percent: number }[];
};

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: "simple",
    name: "Simple starter",
    description: "70% for bills and food, 30% reserved for savings.",
    savingsPercent: 30,
    categories: [
      { name: "Bills", percent: 40 },
      { name: "Food", percent: 30 },
    ],
  },
  {
    id: "essentials",
    name: "Essentials first",
    description: "90% for needs and giving, 10% reserved for savings.",
    savingsPercent: 10,
    categories: [
      { name: "Bills", percent: 35 },
      { name: "Food", percent: 25 },
      { name: "Transportation", percent: 15 },
      { name: "Health", percent: 10 },
      { name: "Church/Giving", percent: 5 },
    ],
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "80% for monthly spending, 20% reserved for savings.",
    savingsPercent: 20,
    categories: [
      { name: "Bills", percent: 25 },
      { name: "Food", percent: 20 },
      { name: "Transportation", percent: 15 },
      { name: "Shopping", percent: 8 },
      { name: "Health", percent: 5 },
      { name: "Family", percent: 3 },
      { name: "Church/Giving", percent: 4 },
    ],
  },
  {
    id: "flexible",
    name: "Flexible lifestyle",
    description: "85% for needs and wants, 15% reserved for savings.",
    savingsPercent: 15,
    categories: [
      { name: "Bills", percent: 25 },
      { name: "Food", percent: 20 },
      { name: "Transportation", percent: 12 },
      { name: "Shopping", percent: 10 },
      { name: "Entertainment", percent: 8 },
      { name: "Health", percent: 5 },
      { name: "Church/Giving", percent: 5 },
    ],
  },
];

export function getBudgetTemplate(id: string) {
  return BUDGET_TEMPLATES.find((template) => template.id === id) ?? null;
}
