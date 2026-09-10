"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

/**
 * Post-checkout activation state (§31). After the provider redirect the plan is
 * granted only by the signed webhook, which can lag the redirect by a few
 * seconds. Rather than tell the user to refresh, this shows a real "activating"
 * state and re-checks the server a handful of times; the page is server-rendered
 * from true entitlement, so it only ever flips to the success banner once the
 * webhook has actually granted access. Premium is never shown before that.
 *
 * `pending` is true only while the redirect says a purchase happened and the
 * server still shows Free — so it never spins for an already-active account.
 */
export function ActivationPoller({ pending }: { pending: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      router.refresh();
      // Give up after ~32s: if the webhook still hasn't landed, something needs
      // a look, and an endless spinner would hide that.
      if (tries >= 8) window.clearInterval(id);
    }, 4000);
    return () => window.clearInterval(id);
  }, [pending, router]);

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground"
    >
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      Payment received — activating your access. This page updates on its own; it
      can take a few seconds.
    </div>
  );
}
