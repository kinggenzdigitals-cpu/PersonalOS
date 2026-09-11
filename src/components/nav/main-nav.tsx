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
  ChevronLeftIcon,
  ChevronRightIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAdd } from "@/components/nav/quick-add";
import { PrivacyToggle } from "@/components/nav/privacy-toggle";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { useSidebarCollapsed, toggleCollapsed } from "@/lib/sidebar-store";
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/home"
      prefetch={false}
      className="flex items-center gap-2"
      title={compact ? "Finance & Habit Tracker" : undefined}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
        <span className="font-display text-lg leading-none">F</span>
      </span>
      {/* sr-only rather than removed, so the link keeps its name when the
          rail is collapsed. */}
      <span
        className={cn(
          "font-display text-base leading-tight tracking-tight",
          compact && "sr-only",
        )}
      >
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
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  moneyBadge: number;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const badge = item.href === "/money" && moneyBadge > 0;
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // A hover tooltip is the only sighted label in the collapsed rail; the
      // sr-only span below is what assistive tech reads.
      title={compact ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
        compact ? "justify-center px-0" : "px-3",
        active
          ? "bg-secondary text-brand"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn(compact && "sr-only")}>{item.label}</span>
      {badge && (
        <span
          className={cn(
            "grid place-items-center rounded-full bg-error text-[10px] font-semibold text-white",
            compact
              ? "absolute right-1 top-1 min-w-4 px-1 leading-4"
              : "ml-auto min-w-5 px-1.5 leading-5",
          )}
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
  compact = false,
}: {
  pathname: string;
  moneyBadge: number;
  onNavigate?: () => void;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  // The server-side entitlement is the only authority. ORing the raw profile
  // role kept the Admin link visible for a request after a demotion, and
  // permanently if the demotion write ever fails.
  const admin = isAdmin;
  const secondary = admin ? [...SECONDARY, ADMIN_ITEM] : SECONDARY;

  // Nav lists only. The privacy, theme and account controls live in the chrome
  // that owns them — the sidebar header and the top bar — never here, because
  // the mobile "More" drawer renders this body too and would show a second
  // copy of controls already in the top bar. `compact` is the collapsed-rail
  // form: icons only, with every label kept for assistive tech.
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
              compact={compact}
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
            compact={compact}
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
  const collapsed = useSidebarCollapsed();
  return (
    // Width comes from --sidebar-w (globals.css) so the rail and the content
    // offset can never disagree; overflow-y-auto lets a long nav list scroll
    // inside the rail, and overflow-x-hidden clips labels mid-transition.
    <aside
      className={cn(
        "app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-card py-6 md:flex",
        collapsed ? "px-2" : "px-4",
      )}
    >
      {/* Header. Expanded: brand at the left, hide-amounts + light/dark at the
          right, in the space that used to sit empty. Collapsed: the mark alone,
          with the two controls stacked beneath it. */}
      <div
        className={cn(
          "mb-6 flex",
          collapsed
            ? "flex-col items-center gap-2"
            : "items-center justify-between gap-2 px-1",
        )}
      >
        <Brand compact={collapsed} />
        <div className={cn("flex shrink-0", collapsed ? "flex-col" : "items-center")}>
          <PrivacyToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className="mb-4">
        <QuickAdd variant={collapsed ? "rail" : "sidebar"} />
      </div>
      <SidebarBody
        pathname={pathname}
        moneyBadge={moneyBadge}
        isAdmin={isAdmin}
        compact={collapsed}
      />
      {/* Collapse control, pinned to the bottom so it never competes with the
          header for the 240px. The visible text IS the accessible name (it
          swaps, and goes sr-only when narrow) and aria-expanded carries the
          state — no aria-label that could flip out of step with the truth. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        {collapsed ? (
          <ChevronRightIcon className="size-[18px] shrink-0" aria-hidden />
        ) : (
          <ChevronLeftIcon className="size-[18px] shrink-0" aria-hidden />
        )}
        <span className={cn(collapsed && "sr-only")}>
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </span>
      </button>
    </aside>
  );
}

/**
 * Top bar, on every screen size. On phones it carries the brand plus its two
 * companions — hide-amounts and light/dark — and the account menu; at md+ the
 * sidebar header carries the brand and those two controls, so only the account
 * menu remains here, top-right.
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
      {/* md:hidden: at md+ these two live beside the brand in the sidebar. */}
      <PrivacyToggle className="md:hidden" />
      <ThemeToggle className="md:hidden" />
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
            prefetch={false}
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
