"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  WalletIcon,
  SparklesIcon,
  BarChart3Icon,
  ListTodoIcon,
  TimerIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAdd } from "@/components/nav/quick-add";
import { PrivacyToggle } from "@/components/nav/privacy-toggle";
import { UserMenu } from "@/components/nav/user-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Primary destinations (desktop sidebar + mobile bottom bar share the first 4).
const PRIMARY: NavItem[] = [
  { href: "/home", label: "Today", icon: HomeIcon },
  { href: "/money", label: "Money", icon: WalletIcon },
  { href: "/habits", label: "Habits", icon: SparklesIcon },
  { href: "/focus", label: "Focus", icon: TimerIcon },
  { href: "/reports", label: "Reports", icon: BarChart3Icon },
  { href: "/feedback", label: "Feedback", icon: MessageSquareIcon },
];

// Kept reachable (features preserved) but out of the primary bar.
const SECONDARY: NavItem[] = [
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/tasks", label: "Tasks", icon: ListTodoIcon },
];

const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Subscribers & Users",
  icon: ShieldCheckIcon,
};

// The four bottom-bar tabs (the fifth is "More").
const BOTTOM = PRIMARY.slice(0, 4);

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/home" className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
        <span className="font-display text-lg leading-none">F</span>
      </span>
      <span className="font-display text-base leading-tight tracking-tight">
        Finance &amp; Habit Tracker
      </span>
    </Link>
  );
}

function NavLink({
  item,
  active,
  moneyBadge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  moneyBadge: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
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
  );
}

/** Shared nav body used by the desktop sidebar and the mobile "More" drawer. */
function SidebarBody({
  pathname,
  moneyBadge,
  onNavigate,
  isAdmin,
}: {
  pathname: string;
  moneyBadge: number;
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  // The server-side entitlement is the only authority. ORing the raw profile
  // role kept the Admin link visible for a request after a demotion, and
  // permanently if the demotion write ever fails.
  const admin = isAdmin;
  const secondary = admin ? [...SECONDARY, ADMIN_ITEM] : SECONDARY;

  // The nav lists are the whole body now. The theme toggle is gone (one theme)
  // and the privacy + account controls moved OUT of this shared body to the
  // two places that own chrome: the mobile top bar and the desktop sidebar
  // footer. They cannot live here — the mobile "More" drawer renders this body
  // too, and would then show a second copy of controls already in the top bar.
  // No `flex-1` and no trailing divider: both only existed to pin the old
  // footers down, and left a stray border and dead space once they were gone.
  return (
    <nav aria-label="Primary" className="space-y-4">
      <ul className="space-y-1">
        {PRIMARY.map((item) => (
          <li key={item.href}>
            <NavLink
              item={item}
              active={isActive(pathname, item.href)}
              moneyBadge={moneyBadge}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-border pt-3">
        {secondary.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            moneyBadge={moneyBadge}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

/** Persistent left sidebar (tablet/desktop). */
export function DesktopSidebar({
  moneyBadge = 0,
  isAdmin = false,
}: {
  moneyBadge?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  return (
    // overflow-y-auto so a long nav list (admins get an extra item) scrolls
    // inside the sidebar instead of overflowing a short viewport.
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto border-r border-border bg-card px-4 py-6 md:flex">
      <div className="mb-6 px-1">
        <Brand />
      </div>
      <div className="mb-4">
        <QuickAdd variant="sidebar" />
      </div>
      <SidebarBody pathname={pathname} moneyBadge={moneyBadge} isAdmin={isAdmin} />
    </aside>
  );
}

/**
 * Top bar, on every screen size: the privacy toggle and the account menu,
 * right-aligned. On phones it also carries the brand, since there is no
 * sidebar; at md+ the sidebar already shows it, so the left side is left
 * empty and the controls simply sit top-right.
 *
 * These two controls used to live in the desktop sidebar's footer instead,
 * bottom-left, which is where nobody looks for "hide my balances" or
 * "sign out". Putting them in one persistent bar at every width also lets
 * the sidebar end on its last nav item, as originally intended.
 *
 * `email` is threaded down from the server layout because the profile row
 * has no email column, so the user menu cannot look it up itself.
 */
export function TopBar({ email }: { email: string | null }) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      {/* min-w-0: a flex item defaults to min-width:auto, so without this the
          brand refuses to shrink below its content and shoves the controls off
          the right edge of a 320px screen. It wraps to two lines instead, the
          same way it already does in the 240px sidebar. */}
      <div className="min-w-0 flex-1">
        {/* Hidden at md+: the sidebar already carries the brand there. The
            flex-1 wrapper stays so the controls keep sitting at the right. */}
        <span className="md:hidden">
          <Brand />
        </span>
      </div>
      <PrivacyToggle />
      <UserMenu email={email} />
    </header>
  );
}

/** Mobile bottom navigation: Today · Money · Habits · Focus · More. */
export function MobileBottomNav({
  moneyBadge = 0,
  isAdmin = false,
}: {
  moneyBadge?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const moreActive = !BOTTOM.some((t) => isActive(pathname, t.href));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {BOTTOM.map((tab) => {
        const active = isActive(pathname, tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {tab.label}
            {tab.href === "/money" && moneyBadge > 0 && (
              <span className="absolute right-[22%] top-1 size-2 rounded-full bg-error" />
            )}
          </Link>
        );
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="More"
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              moreActive ? "text-brand" : "text-muted-foreground",
            )}
          >
            <MenuIcon className="size-5" aria-hidden />
            More
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-72 flex-col px-4 py-6">
          <SheetTitle className="sr-only">More</SheetTitle>
          <div className="mb-6 px-1">
            <Brand />
          </div>
          <SidebarBody
            pathname={pathname}
            moneyBadge={moneyBadge}
            onNavigate={() => setOpen(false)}
            isAdmin={isAdmin}
          />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
