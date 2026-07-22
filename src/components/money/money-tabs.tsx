"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/money", label: "Overview" },
  { href: "/money/transactions", label: "Transactions" },
  { href: "/money/owed", label: "Owed" },
  { href: "/money/budgets", label: "Budgets" },
  { href: "/money/bills", label: "Bills" },
];

export function MoneyTabs() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <nav
        aria-label="Money sections"
        className="inline-flex gap-1 rounded-full bg-secondary p-1"
      >
        {TABS.map((tab) => {
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
