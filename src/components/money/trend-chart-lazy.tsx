"use client";

import dynamic from "next/dynamic";

export const TrendChart = dynamic(
  () => import("./trend-chart").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full animate-pulse rounded-lg bg-secondary" />
    ),
  },
);
