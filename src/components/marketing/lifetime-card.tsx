import Link from "next/link";
import { InfinityIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHP, usdToPhpEstimate } from "@/lib/pricing-display";

/**
 * The Founding Lifetime pricing card. Every figure comes from the live offer
 * state (config + real purchase count resolved server-side) — the "spots left"
 * number is genuine, and when the offer is sold out or closed the card says so
 * and shows the regular price rather than a launch price nobody can still get.
 */
export function LifetimeCard({
  available,
  remaining,
  priceUSD,
  regularUSD,
  ctaHref,
  className,
}: {
  available: boolean;
  /** null when there is no count cap. */
  remaining: number | null;
  priceUSD: number;
  regularUSD: number;
  ctaHref: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border-2 border-accent-brand bg-card p-6 shadow-card",
        className,
      )}
    >
      <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent-brand px-3 py-0.5 text-xs font-medium text-[color:var(--brand-foreground)]">
        <SparklesIcon className="size-3.5" /> Founding offer
      </span>

      <h3 className="flex items-center gap-2 font-display text-xl">
        <InfinityIcon className="size-5 text-sage" aria-hidden /> Premium Lifetime
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pay once. Keep Premium for the life of the product. No recurring payment.
      </p>

      <div className="mt-5 min-h-[104px]">
        {available ? (
          <>
            <p className="font-display text-4xl">
              ${priceUSD}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                one-time
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ≈ {formatPHP(usdToPhpEstimate(priceUSD), 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="line-through">${regularUSD}</span> regular price
            </p>
            {remaining != null && (
              <p className="mt-1 text-xs font-medium text-sage">
                {remaining} of the first 100 spots left
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-4xl">
              ${regularUSD}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                one-time
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ≈ {formatPHP(usdToPhpEstimate(regularUSD), 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The founding launch price has closed.
            </p>
          </>
        )}
      </div>

      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-accent-brand px-5 py-2.5 text-sm font-medium text-[color:var(--brand-foreground)] shadow-soft transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SparklesIcon className="size-4" /> Get Lifetime Access
      </Link>

      <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
        <li>Everything in Premium, at the highest limits</li>
        <li>One payment — never billed again</li>
        <li>All future updates to Premium features</li>
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground">
        &ldquo;Lifetime&rdquo; means the lifetime of the product, per our{" "}
        <Link href="/terms" className="underline underline-offset-4">
          Terms
        </Link>
        . Charged in USD.
      </p>
    </div>
  );
}
