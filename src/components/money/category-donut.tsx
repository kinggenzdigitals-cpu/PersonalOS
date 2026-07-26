"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format";
import { Money, usePrivacyHidden } from "@/components/ui/money";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--sage)",
  "#B08A4F",
  "#C77D8E",
  "#5B9AA0",
  "#9A7BB0",
];

export type CategorySlice = {
  name: string;
  amount: number;
  color?: string | null;
};

export function CategoryDonut({
  data,
  currency,
}: {
  data: CategorySlice[];
  currency: string;
}) {
  const hidden = usePrivacyHidden();
  const total = data.reduce((s, d) => s + d.amount, 0);

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No spending this month yet
      </div>
    );
  }

  const slices = data.map((d, i) => ({
    ...d,
    fill: d.color ?? PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                fontSize: 12,
              }}
              formatter={(value, name) => [
                hidden ? "₱••••••" : formatMoney(Number(value), currency),
                name as string,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Spent</span>
          <span className="tnum font-display text-lg">
            <Money value={total} currency={currency} />
          </span>
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {slices.slice(0, 6).map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.fill }}
            />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="tnum text-muted-foreground">
              <Money value={s.amount} currency={currency} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
