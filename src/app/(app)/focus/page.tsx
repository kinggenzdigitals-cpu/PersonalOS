import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getFocusLinkOptions, getTodayFocusSummary } from "@/lib/queries/focus";
import { FocusTimer } from "@/components/focus/focus-timer";

export const metadata: Metadata = { title: "Focus Timer" };

export default async function FocusPage() {
  const profile = await requireOnboardedProfile();
  const [options, summary] = await Promise.all([
    getFocusLinkOptions(),
    getTodayFocusSummary(profile.timezone),
  ]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">Focus Timer</h1>
        <p className="text-sm text-muted-foreground">
          Pomodoro sessions to help you stay on track.
        </p>
      </header>
      <FocusTimer options={options} summary={summary} />
    </div>
  );
}
