"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SparklesIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { PLANS, PLAN_PRICES } from "@/lib/plans";

type Ctx = {
  /** Open the upgrade modal with a specific reason. */
  promptUpgrade: (message: string) => void;
  /** Route a server-action error: cap errors open the modal, others toast. */
  notify: (error: string) => void;
};

const UpgradeContext = React.createContext<Ctx | null>(null);

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<string | null>(null);

  const value = React.useMemo<Ctx>(
    () => ({
      promptUpgrade: (m) => setMessage(m),
      notify: (e) => {
        if (/upgrade/i.test(e)) setMessage(e);
        else toast.error(e);
      },
    }),
    [],
  );

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <FormSheet
        open={message !== null}
        onOpenChange={(o) => !o && setMessage(null)}
        title="Upgrade your plan"
        size="lg"
      >
        {(close) => (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["pro", "premium"] as const).map((id) => {
                const p = PLANS[id];
                const a = PLAN_PRICES[id].annual;
                return (
                  <div key={id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-lg">{p.name}</p>
                      {p.label && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                          {p.label}
                        </span>
                      )}
                    </div>
                    <p className="tnum font-display text-xl">
                      {peso(a.monthlyEq)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        /mo
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {peso(a.total)} / yr · save {peso(a.save)}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {p.features.slice(1, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={close}>
                Maybe later
              </Button>
              <Button variant="outline" asChild>
                <Link href="/subscription" onClick={close}>
                  Compare all plans
                </Link>
              </Button>
              <Button asChild className="ml-auto">
                <Link href="/settings" onClick={close}>
                  <SparklesIcon className="size-4" /> Upgrade
                </Link>
              </Button>
            </div>
          </div>
        )}
      </FormSheet>
    </UpgradeContext.Provider>
  );
}

export function useUpgrade(): Ctx {
  const ctx = React.useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}
