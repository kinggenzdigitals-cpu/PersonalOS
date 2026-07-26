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
  TimerIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAdd } from "@/components/nav/quick-add";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { SidebarControls } from "@/components/nav/sidebar-controls";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useProfile } from "@/components/providers/profile-provider";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/money", label: "Money", icon: WalletIcon },
  { href: "/habits", label: "Habits", icon: SparklesIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/tasks", label: "Tasks", icon: ListTodoIcon },
  { href: "/focus", label: "Focus", icon: TimerIcon },
  { href: "/reports", label: "Reports", icon: BarChart3Icon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/home" className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground shadow-soft">
        <span className="font-display text-lg leading-none">F</span>
      </span>
      <span className="font-display text-base leading-tight tracking-tight">
        Finance &amp; Habit Tracker
      </span>
    </Link>
  );
}

/** The shared nav body used by both the desktop sidebar and mobile drawer. */
function SidebarBody({
  pathname,
  moneyBadge,
  onNavigate,
}: {
  pathname: string;
  moneyBadge: number;
  onNavigate?: () => void;
}) {
  const profile = useProfile();
  const initial =
    profile.display_name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <>
      <nav aria-label="Primary" className="flex-1">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-brand"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
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
      </nav>

      <div className="mt-4 border-t border-border pt-3">
        <SidebarControls />
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-4">
        <span className="grid size-9 place-items-center rounded-full bg-sage-soft text-sm font-semibold text-sage">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {profile.display_name ?? "You"}
          </p>
          <p className="text-xs text-muted-foreground">{profile.currency}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOutIcon className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}

/** Persistent left sidebar (tablet/desktop). */
export function DesktopSidebar({ moneyBadge = 0 }: { moneyBadge?: number }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 md:flex">
      <div className="mb-6 flex items-center justify-between px-1">
        <Brand />
        <ThemeToggle />
      </div>
      <div className="mb-4">
        <QuickAdd variant="sidebar" />
      </div>
      <SidebarBody pathname={pathname} moneyBadge={moneyBadge} />
    </aside>
  );
}

/** Mobile top bar with a hamburger that opens the sidebar as a drawer. */
export function MobileTopBar({ moneyBadge = 0 }: { moneyBadge?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MenuIcon className="size-5" />
            {moneyBadge > 0 && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-error" />
            )}
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-72 flex-col px-4 py-6"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mb-6 px-1">
            <Brand />
          </div>
          <SidebarBody
            pathname={pathname}
            moneyBadge={moneyBadge}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Brand />
      </div>

      <QuickAdd variant="bar" />
      <ThemeToggle />
    </header>
  );
}
