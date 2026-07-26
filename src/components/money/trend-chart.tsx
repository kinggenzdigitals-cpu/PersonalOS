"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { usePrivacyHidden } from "@/components/ui/money";

type Point = { month: string; income: number; expense: number };

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export function TrendChart({
  data,
  currency,
}: {
  data: Point[];
  currency: string;
}) {
  const hidden = usePrivacyHidden();
  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No income or expenses yet
      </div>
    );
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={2} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--secondary)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              hidden ? "₱••••••" : formatMoney(Number(value), currency),
              name === "income" ? "Income" : "Expense",
            ]}
            labelFormatter={(l) => String(l)}
          />
          <Bar dataKey="income" fill="var(--money-up)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="var(--money-down)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-money-up" /> Income
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-money-down" /> Expense
        </span>
      </div>
    </div>
  );
}
