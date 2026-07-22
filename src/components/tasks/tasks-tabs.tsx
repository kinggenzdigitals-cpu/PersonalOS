"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { view: "today", label: "Today" },
  { view: "upcoming", label: "Upcoming" },
  { view: "backlog", label: "Backlog" },
  { view: "done", label: "Done" },
];

export function TasksTabs() {
  const params = useSearchParams();
  const current = params.get("view") ?? "today";

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <nav
        aria-label="Task views"
        className="inline-flex gap-1 rounded-full bg-secondary p-1"
      >
        {TABS.map((tab) => {
          const active = current === tab.view;
          return (
            <Link
              key={tab.view}
              href={`/tasks?view=${tab.view}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
