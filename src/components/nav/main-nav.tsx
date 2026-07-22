"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  WalletIcon,
  SparklesIcon,
  LogOutIcon,
  BarChart3Icon,
  SettingsIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAdd } from "@/components/nav/quick-add";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/components/providers/profile-provider";

const ICONS: Record<string, LucideIcon> = {
  Home: HomeIcon,
  Calendar: CalendarIcon,
  Wallet: WalletIcon,
  Sparkles: SparklesIcon,
};

const NAV = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/calendar", label: "Calendar", icon: "Calendar" },
  { href: "/money", label: "Money", icon: "Wallet" },
  { href: "/habits", label: "Habits", icon: "Sparkles" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile bottom tab bar (Home · Calendar · FAB · Money · Habits). */
export function BottomNav({ moneyBadge = 0 }: { moneyBadge?: number }) {
  const pathname = usePathname();
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around">
        {left.map((item) => (
          <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <li className="flex items-center justify-center">
          <QuickAdd variant="fab" />
        </li>
        {right.map((item) => (
          <NavTab
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            badge={item.href === "/money" ? moneyBadge : 0}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({
  item,
  active,
  badge = 0,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  badge?: number;
}) {
  const Icon = ICONS[item.icon];
  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
          active ? "text-brand" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="relative">
          <Icon className="size-5" aria-hidden />
          {badge > 0 && (
            <span
              className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[9px] font-semibold leading-4 text-white"
              aria-label={`${badge} due`}
            >
              {badge}
            </span>
          )}
        </span>
        {item.label}
      </Link>
    </li>
  );
}

/** Desktop left sidebar. */
export function DesktopSidebar({ moneyBadge = 0 }: { moneyBadge?: number }) {
  const pathname = usePathname();
  const profile = useProfile();
  const initial =
    profile.display_name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-primary-foreground shadow-soft">
          <span className="font-display text-lg leading-none">L</span>
        </span>
        <span className="font-display text-lg tracking-tight">Life OS</span>
        <ThemeToggle className="ml-auto" />
      </div>

      <div className="mb-4">
        <QuickAdd variant="sidebar" />
      </div>

      <ul className="flex-1 space-y-1">
        {NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-brand"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
                {item.label}
                {item.href === "/money" && moneyBadge > 0 && (
                  <span
                    className="ml-auto grid min-w-5 place-items-center rounded-full bg-error px-1.5 text-[10px] font-semibold leading-5 text-white"
                    aria-label={`${moneyBadge} bills due`}
                  >
                    {moneyBadge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 place-items-center rounded-full bg-sage-soft text-sm font-semibold text-sage">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {profile.display_name ?? "You"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {profile.currency}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/tasks">
              <ListTodoIcon className="size-4" /> Tasks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/reports">
              <BarChart3Icon className="size-4" /> Reports
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon className="size-4" /> Settings
            </Link>
          </DropdownMenuItem>
          <form action="/auth/signout" method="post">
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full cursor-pointer">
                <LogOutIcon className="size-4" /> Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
