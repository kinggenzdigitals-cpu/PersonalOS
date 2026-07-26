"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { NetWorthItemForm } from "@/components/money/networth-item-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { Asset, Liability } from "@/lib/supabase/types";

function kindLabel(kind: string) {
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function NetWorthSection({
  type,
  items,
}: {
  type: "asset" | "liability";
  items: (Asset | Liability)[];
}) {
  const currency = useCurrency();
  const isAsset = type === "asset";
  const title = isAsset ? "Assets" : "Liabilities";
  const empty = isAsset
    ? "Add non-liquid assets like property, investments, or a vehicle."
    : "Add what you owe — mortgage, loans, credit cards.";

  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg">{title}</h2>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {items.map((item) => {
            const amount = isAsset
              ? (item as Asset).value
              : (item as Liability).balance;
            return (
              <FormSheet
                key={item.id}
                title={isAsset ? "Edit asset" : "Edit liability"}
                trigger={
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {kindLabel(item.kind)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tnum shrink-0 font-medium",
                        isAsset ? "text-money-up" : "text-money-down",
                      )}
                    >
                      {isAsset ? "" : "−"}
                      <Money value={Number(amount)} currency={currency} />
                    </span>
                  </button>
                }
              >
                {(close) => (
                  <NetWorthItemForm type={type} initial={item} onDone={close} />
                )}
              </FormSheet>
            );
          })}
        </div>
      )}

      <FormSheet
        title={isAsset ? "New asset" : "New liability"}
        trigger={
          <Button variant="outline" className="w-full">
            <PlusIcon className="size-4" /> Add {type}
          </Button>
        }
      >
        {(close) => <NetWorthItemForm type={type} onDone={close} />}
      </FormSheet>
    </section>
  );
}
