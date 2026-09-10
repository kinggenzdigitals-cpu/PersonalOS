"use client";

import * as React from "react";
import { toast } from "sonner";
import { InfinityIcon, SparklesIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startLifetimeCheckout } from "@/app/(app)/settings/billing-actions";

/**
 * In-app Founding Lifetime purchase (§28, §30). Renders only for an eligible
 * user when the offer is genuinely available — the server decides both, and
 * re-checks availability again inside startLifetimeCheckout, so this button can
 * never sell a closed offer. On success the browser is sent to the provider's
 * hosted checkout; entitlement is granted only by the signed webhook, never here.
 */
export function LifetimeUpsell({
  eligible,
  remaining,
  priceUSD,
  regularUSD,
}: {
  eligible: boolean;
  remaining: number | null;
  priceUSD: number;
  regularUSD: number;
}) {
  const [busy, setBusy] = React.useState(false);

  if (!eligible) return null;

  async function buy() {
    setBusy(true);
    const res = await startLifetimeCheckout();
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    window.location.assign(res.url);
  }

  return (
    <div className="rounded-2xl border-2 border-accent-brand bg-accent-brand/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-sage">
        <SparklesIcon className="size-4" /> Founding member offer
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg">
            <InfinityIcon className="size-5 text-sage" aria-hidden /> Premium
            Lifetime — ${priceUSD}{" "}
            <span className="text-sm font-normal text-muted-foreground line-through">
              ${regularUSD}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            One payment, never billed again. Charged in USD.
            {remaining != null && ` ${remaining} of the first 100 spots left.`}
          </p>
        </div>
        <Button
          onClick={buy}
          disabled={busy}
          className="bg-accent-brand text-[#12280a] hover:opacity-90"
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          Get Lifetime Access
        </Button>
      </div>
    </div>
  );
}
