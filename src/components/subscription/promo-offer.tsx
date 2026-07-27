"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SparklesIcon, TimerIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROMO } from "@/lib/promo-config";
import { claimOffer } from "@/app/(app)/subscription/promo-actions";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

/**
 * Genuine promo card. The countdown is driven by the server-set `expiresAt`, so
 * refresh / reopen never resets it and it truly expires. Only shown to eligible
 * users; when no offer exists they can reveal one, once claimed it counts down.
 */
export function PromoOffer({
  expiresAt,
  eligible,
}: {
  expiresAt: string | null;
  eligible: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!eligible) return null;

  if (!expiresAt) {
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
          <SparklesIcon className="size-4" /> Limited upgrade offer
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reveal a genuine 12-minute discount on the annual Pro or Premium plan.
        </p>
        <Button
          className="mt-3"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await claimOffer();
            setBusy(false);
            if (!r.ok) return toast.error(r.error ?? "Try again.");
            router.refresh();
          }}
        >
          {busy && <Loader2Icon className="size-4 animate-spin" />}
          Reveal my offer
        </Button>
      </div>
    );
  }

  const remaining = now === 0 ? null : Math.max(0, new Date(expiresAt).getTime() - now);
  if (remaining !== null && remaining <= 0) {
    return (
      <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        This offer has expired — regular pricing applies.
      </div>
    );
  }
  const mm = remaining === null ? "--" : String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = remaining === null ? "--" : String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="rounded-2xl border-2 border-brand bg-brand/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
          <SparklesIcon className="size-4" /> Limited upgrade offer
        </p>
        <span className="tnum flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
          <TimerIcon className="size-3.5" aria-hidden /> {mm}:{ss}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["pro", "premium"] as const).map((id) => {
          const o = PROMO.offers[id];
          return (
            <div key={id} className="rounded-xl border border-border bg-card p-3">
              <p className="font-display">{o.name}</p>
              <p className="text-sm">
                <span className="text-muted-foreground line-through">
                  {peso(o.regular)}
                </span>{" "}
                <span className="font-semibold text-brand">{peso(o.promo)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Save {peso(o.save)} · {peso(o.monthly)}/mo · renews at{" "}
                {peso(o.regular)}/yr unless cancelled
              </p>
            </div>
          );
        })}
      </div>
      <Button asChild className="mt-3 w-full">
        <Link href="/settings">
          <SparklesIcon className="size-4" /> Subscribe now
        </Link>
      </Button>
    </div>
  );
}
