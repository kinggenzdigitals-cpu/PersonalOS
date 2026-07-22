"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MoodPoint = {
  date: string;
  mood: number;
  energy: number | null;
  stress: number | null;
};

export function MoodLineChart({ data }: { data: MoodPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
        Check in a few days to see trends
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="mood"
            name="Mood"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="energy"
            name="Energy"
            stroke="var(--sage)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="stress"
            name="Stress"
            stroke="var(--warning)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-brand" /> Mood
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-sage" /> Energy
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-warning" /> Stress
        </span>
      </div>
    </div>
  );
}
