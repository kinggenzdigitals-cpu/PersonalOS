"use client";

import dynamic from "next/dynamic";

export const CategoryDonut = dynamic(
  () => import("./category-donut").then((m) => m.CategoryDonut),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-lg bg-secondary" />
    ),
  },
);
