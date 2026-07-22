"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  CircleCheckBigIcon,
  SmileIcon,
  ListTodoIcon,
  CalendarPlusIcon,
  PlusIcon,
  ChevronLeftIcon,
  CheckIcon,
  Loader2Icon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TransactionForm } from "@/components/money/transaction-form";
import { MoodForm } from "@/components/habits/mood-form";
import { TaskForm } from "@/components/tasks/task-form";
import { EventForm } from "@/components/calendar/event-form";
import { useReference } from "@/components/providers/reference-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { localDateKey } from "@/lib/date";
import { LIFE_AREA_MAP } from "@/lib/constants";
import {
  refreshHabitsBoard,
  setHabitLog,
} from "@/app/(app)/habits/actions";
import { getTodayMoodAction } from "@/app/(app)/habits/mood-actions";
import type { HabitBoardItem } from "@/lib/queries/habits";
import type { MoodEntry } from "@/lib/supabase/types";

type View = "menu" | "expense" | "income" | "habit" | "mood" | "task" | "event";

type QuickAction = {
  key: string;
  label: string;
  icon: React.ElementType;
  tint: string;
  view?: View;
  requiresAccount?: boolean;
};

const ACTIONS: QuickAction[] = [
  { key: "expense", label: "Expense", icon: ArrowDownCircleIcon, tint: "var(--error)", view: "expense", requiresAccount: true },
  { key: "income", label: "Income", icon: ArrowUpCircleIcon, tint: "var(--success)", view: "income", requiresAccount: true },
  { key: "habit", label: "Habit ✓", icon: CircleCheckBigIcon, tint: "var(--sage)", view: "habit" },
  { key: "mood", label: "Mood", icon: SmileIcon, tint: "var(--brand)", view: "mood" },
  { key: "task", label: "Task", icon: ListTodoIcon, tint: "var(--chart-4)", view: "task" },
  { key: "event", label: "Event", icon: CalendarPlusIcon, tint: "var(--chart-3)", view: "event" },
];

const TITLES: Record<View, string> = {
  menu: "Quick add",
  expense: "Add expense",
  income: "Add income",
  habit: "Log habits",
  mood: "How are you today?",
  task: "Add task",
  event: "Add event",
};

export function QuickAdd({ variant = "fab" }: { variant?: "fab" | "sidebar" }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("menu");
  const { accounts } = useReference();
  const profile = useProfile();
  const today = localDateKey(profile.timezone);

  function reset() {
    setView("menu");
  }

  function handle(action: QuickAction) {
    if (action.view) {
      if (action.requiresAccount && accounts.length === 0) {
        toast.error("Add an account first from the Money tab.");
        return;
      }
      setView(action.view);
      return;
    }
    setOpen(false);
    toast(`${action.label} capture is coming soon`, {
      description: "Arrives with the Tasks and Calendar milestones.",
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>
        {variant === "fab" ? (
          <button
            type="button"
            aria-label="Quick add"
            className="grid size-14 -translate-y-4 place-items-center rounded-full bg-brand text-primary-foreground shadow-lifted transition-transform hover:bg-brand-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <PlusIcon className="size-6" />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusIcon className="size-4" /> Quick add
          </button>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            {view !== "menu" && (
              <button
                type="button"
                onClick={reset}
                aria-label="Back"
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
            )}
            {TITLES[view]}
          </SheetTitle>
        </SheetHeader>

        {view === "menu" && (
          <div className="grid grid-cols-3 gap-3 p-4">
            {ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => handle(action)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium shadow-soft transition-all",
                  "hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                )}
              >
                <span
                  className="grid size-11 place-items-center rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${action.tint} 14%, transparent)`,
                    color: action.tint,
                  }}
                >
                  <action.icon className="size-5" />
                </span>
                {action.label}
              </button>
            ))}
          </div>
        )}

        {(view === "expense" || view === "income") && (
          <div className="p-4 pt-2">
            <TransactionForm
              defaultType={view}
              allowTypeToggle
              onDone={() => setOpen(false)}
            />
          </div>
        )}

        {view === "habit" && (
          <div className="p-4 pt-2">
            <QuickHabits today={today} />
          </div>
        )}

        {view === "mood" && (
          <div className="p-4 pt-2">
            <QuickMood today={today} onDone={() => setOpen(false)} />
          </div>
        )}

        {view === "task" && (
          <div className="p-4 pt-2">
            <TaskForm onDone={() => setOpen(false)} />
          </div>
        )}

        {view === "event" && (
          <div className="p-4 pt-2">
            <EventForm onDone={() => setOpen(false)} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuickHabits({ today }: { today: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<HabitBoardItem[] | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    refreshHabitsBoard().then((b) => active && setItems(b));
    return () => {
      active = false;
    };
  }, []);

  async function toggle(habitId: string, current: HabitBoardItem) {
    const done = current.todayStatus === "completed";
    setPending(habitId);
    setItems(
      (prev) =>
        prev?.map((i) =>
          i.habit.id === habitId
            ? { ...i, todayStatus: done ? null : "completed" }
            : i,
        ) ?? null,
    );
    const result = await setHabitLog(habitId, today, done ? null : "completed");
    if (!result.ok) toast.error(result.error);
    else router.refresh();
    setPending(null);
  }

  if (!items) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No habits yet. Add some from the Habits tab.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const done = item.todayStatus === "completed";
        const color = LIFE_AREA_MAP[item.habit.life_area].color;
        return (
          <li key={item.habit.id}>
            <button
              type="button"
              onClick={() => toggle(item.habit.id, item)}
              disabled={pending === item.habit.id}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                done
                  ? "border-transparent"
                  : "border-border hover:border-brand/40",
              )}
              style={done ? { backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full",
                  done ? "text-primary-foreground" : "border-2 border-dashed border-border",
                )}
                style={done ? { backgroundColor: color } : undefined}
              >
                {done && <CheckIcon className="size-4" />}
              </span>
              <span className="flex-1 font-medium">{item.habit.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QuickMood({
  today,
  onDone,
}: {
  today: string;
  onDone: () => void;
}) {
  const [entry, setEntry] = React.useState<MoodEntry | null | undefined>(
    undefined,
  );

  React.useEffect(() => {
    let active = true;
    getTodayMoodAction().then((m) => active && setEntry(m));
    return () => {
      active = false;
    };
  }, []);

  if (entry === undefined) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }

  return <MoodForm initial={entry} entryDate={today} onDone={onDone} />;
}
