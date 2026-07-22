"use client";

import * as React from "react";
import type { Account, Category } from "@/lib/supabase/types";

type ReferenceData = {
  accounts: Account[];
  categories: Category[];
  expenseCategories: Category[];
  incomeCategories: Category[];
};

const ReferenceContext = React.createContext<ReferenceData | null>(null);

export function ReferenceProvider({
  accounts,
  categories,
  children,
}: {
  accounts: Account[];
  categories: Category[];
  children: React.ReactNode;
}) {
  const value = React.useMemo<ReferenceData>(
    () => ({
      accounts,
      categories,
      expenseCategories: categories.filter((c) => c.kind === "expense"),
      incomeCategories: categories.filter((c) => c.kind === "income"),
    }),
    [accounts, categories],
  );

  return (
    <ReferenceContext.Provider value={value}>
      {children}
    </ReferenceContext.Provider>
  );
}

export function useReference(): ReferenceData {
  const ctx = React.useContext(ReferenceContext);
  if (!ctx) {
    throw new Error("useReference must be used within a ReferenceProvider");
  }
  return ctx;
}
