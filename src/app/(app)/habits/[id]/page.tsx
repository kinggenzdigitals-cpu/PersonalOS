import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeftIcon, FlameIcon, TrophyIcon } from "lucide-react";
import { format } from "date-fns";
import { requireOnboardedProfile } from "@/lib/auth";
import { getHabitDetail, localToday } from "@/lib/queries/habits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HabitHeatmap } from "@/components/habits/habit-heatmap";
import { EditHabitButton } from "@/components/habits/edit-habit-button";
import { LIFE_AREA_MAP } from "@/lib/constants";

export const metadata: Metadata = { title: "Habit" };

export default async function HabitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireOnboardedProfile();
  const detail = await getHabitDetail(profile.timezone, id);
  if (!detail) notFound();

  const today = format(localToday(profile.timezone), "yyyy-MM-dd");
  const area = LIFE_AREA_MAP[detail.habit.life_area];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/habits"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Habits
        </Link>
        <EditHabitButton habit={detail.habit} />
      </div>

      <header className="space-y-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `color-mix(in srgb, ${area.color} 15%, transparent)`,
            color: area.color,
          }}
        >
          {area.label}
        </span>
        <h1 className="font-display text-2xl tracking-tight">
          {detail.habit.name}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<FlameIcon className="size-4 text-brand" />}
          label="Current streak"
          value={`${detail.streak}`}
          suffix="days"
        />
        <StatCard
          icon={<TrophyIcon className="size-4 text-warning" />}
          label="Longest streak"
          value={`${detail.longest}`}
          suffix="days"
        />
        <StatCard label="This week" value={`${detail.weeklyPct}%`} />
        <StatCard label="This month" value={`${detail.monthlyPct}%`} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">
            {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HabitHeatmap
            month={detail.month}
            color={area.color}
            today={today}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="tnum mt-1 font-display text-2xl">
        {value}
        {suffix && (
          <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>
        )}
      </p>
    </div>
  );
}
