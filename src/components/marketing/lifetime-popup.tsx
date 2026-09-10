"use client";

import * as React from "react";
import Link from "next/link";
import { SparklesIcon, XIcon } from "lucide-react";

const DISMISS_KEY = "fht-lifetime-popup";
const DISMISS_DAYS = 7;

/**
 * Founding-member conversion popup (§16).
 *
 * Rules honoured: never on arrival (fires after ~45s of engagement OR past ~55%
 * scroll, whichever comes first); dismissal is remembered for a week; it is
 * fully keyboard-accessible (role=dialog, Escape, a real close button, focus
 * moved in on open and restored on close, Tab trapped inside); and it simply
 * does not render when the offer is unavailable. There is no countdown — the
 * offer has no per-visitor deadline, so showing one would be fake urgency.
 */
export function LifetimePopup({
  href,
  priceUSD,
  regularUSD,
  remaining,
  available,
}: {
  href: string;
  priceUSD: number;
  regularUSD: number;
  remaining: number | null;
  available: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  // Decide whether we're allowed to show it at all (offer live + not recently
  // dismissed), then arm the engagement triggers.
  React.useEffect(() => {
    if (!available) return;
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && Date.now() < until) return;
      }
    } catch {
      // storage blocked — treat as not dismissed
    }

    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      setOpen(true);
    };
    const timer = window.setTimeout(fire, 45_000);
    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled =
        (window.scrollY + window.innerHeight) / doc.scrollHeight;
      if (scrolled > 0.55) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [available]);

  // Focus management + Tab trap while open.
  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusables = node?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusables?.[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && focusables && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
      );
    } catch {
      // not persisted — it just may reappear next session
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifetime-popup-title"
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lifted"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" />
        </button>

        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-brand/15 px-2.5 py-0.5 text-xs font-medium text-sage">
          <SparklesIcon className="size-3.5" /> Founding member offer
        </p>
        <h2
          id="lifetime-popup-title"
          className="mt-3 font-display text-2xl leading-tight"
        >
          Premium Lifetime for ${priceUSD}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One payment, never billed again — versus <span className="line-through">${regularUSD}</span> regular.
          {remaining != null && ` Only ${remaining} of the first 100 spots left.`}
        </p>

        <Link
          href={href}
          onClick={close}
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-accent-brand px-5 py-2.5 text-sm font-medium text-[#12280a] shadow-soft transition-opacity hover:opacity-90"
        >
          <SparklesIcon className="size-4" /> Get Lifetime Access
        </Link>
        <button
          type="button"
          onClick={close}
          className="mt-2 w-full rounded-full px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
