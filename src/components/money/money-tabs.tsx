"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClockIcon,
  ChartPieIcon,
  HandCoinsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListIcon,
  TargetIcon,
  UploadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/money", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/money/transactions", label: "Transactions", icon: ListIcon },
  { href: "/money/net-worth", label: "Net Worth", icon: LandmarkIcon },
  { href: "/money/goals", label: "Goals", icon: TargetIcon },
  { href: "/money/owed", label: "Owed", icon: HandCoinsIcon },
  { href: "/money/budgets", label: "Budgets", icon: ChartPieIcon },
  { href: "/money/bills", label: "Bills", icon: CalendarClockIcon },
  { href: "/money/import", label: "Import", icon: UploadIcon },
];

export function MoneyTabs() {
  const pathname = usePathname();
  return (
    <div className="money-tabs -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Money sections"
        className="inline-flex min-w-max gap-1 rounded-xl border border-border bg-card/75 p-1.5 shadow-soft backdrop-blur"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/money"
              ? pathname === "/money"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(1,125,254,0.28)]"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
