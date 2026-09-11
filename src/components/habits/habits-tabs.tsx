"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/habits", label: "Habits" },
  { href: "/habits/grid", label: "Grid" },
  { href: "/habits/mood", label: "Mood" },
  { href: "/habits/stats", label: "Stats" },
];

export function HabitsTabs() {
  const pathname = usePathname();
    return (
    <nav
      aria-label="Habits sections"
      className="inline-flex gap-1 rounded-full bg-secondary p-1"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/habits"
            ? pathname === "/habits"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-tab-active/12 text-tab-active shadow-soft"
                : "text-foreground/80 hover:bg-tab-active/10 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
