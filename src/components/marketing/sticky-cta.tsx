"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

/**
 * Sticky mobile CTA (§17). Appears once the visitor has scrolled past the hero
 * so it never covers the first screen, and only on small viewports (the desktop
 * header CTA stays visible on its own). When the founding offer is live it
 * leads with Lifetime; otherwise it's the primary Start Free.
 */
export function StickyCta({
  freeHref,
  lifetimeHref,
  lifetimePriceUSD,
  offerAvailable,
}: {
  freeHref: string;
  lifetimeHref: string;
  lifetimePriceUSD: number;
  offerAvailable: boolean;
}) {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      hidden={!shown}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      {offerAvailable ? (
        <div className="flex items-center gap-3">
          <Link
            href={freeHref}
            className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Start Free
          </Link>
          <Link
            href={lifetimeHref}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-brand px-4 py-2.5 text-sm font-medium text-[#12280a] shadow-soft"
          >
            <SparklesIcon className="size-4" /> Lifetime ${lifetimePriceUSD}
          </Link>
        </div>
      ) : (
        <Link
          href={freeHref}
          className="flex items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-soft"
        >
          Start Free <ArrowRightIcon className="size-4" />
        </Link>
      )}
    </div>
  );
}
