"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How It Works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Public marketing header: sticky, one consistent primary CTA (Start Free), a
 * desktop nav of in-page anchors, and an accessible mobile menu. `startHref`
 * carries any UTM params from the server so attribution survives the click.
 */
export function MarketingHeader({ startHref = "/signup" }: { startHref?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
            <span className="font-display text-lg leading-none">F</span>
          </span>
          <span className="font-display text-base tracking-tight sm:text-lg">
            Finance &amp; Habit Tracker
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Sign In
          </Link>
          <Link
            href={startHref}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-soft transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start Free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-9 place-items-center rounded-lg text-foreground transition-colors hover:bg-secondary md:hidden"
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={cn("border-t border-border/60 md:hidden", !open && "hidden")}>
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-border px-4 py-2 text-center font-medium"
            >
              Sign In
            </Link>
            <Link
              href={startHref}
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full bg-brand px-4 py-2 text-center font-medium text-brand-foreground"
            >
              Start Free
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
