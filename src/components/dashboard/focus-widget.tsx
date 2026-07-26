import Link from "next/link";
import { TimerIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayFocusSummary } from "@/lib/queries/focus";

/** Compact dashboard link into the Focus Timer with today's stats. */
export async function FocusWidget({ timezone }: { timezone: string }) {
  const s = await getTodayFocusSummary(timezone);
  return (
    <Link href="/focus" className="block">
      <Card className="shadow-card transition-colors hover:bg-secondary/40">
        <CardContent className="flex items-center gap-3 pt-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <TimerIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Focus Timer</p>
            <p className="text-xs text-muted-foreground">
              {s.completedSessions} session{s.completedSessions === 1 ? "" : "s"}{" "}
              · {s.focusedMinutes} min focused today
            </p>
          </div>
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
