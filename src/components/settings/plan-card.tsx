"use client";

import { SparklesIcon, CheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { PLANS, monthlyEquivalent, type PlanId } from "@/lib/plans";
import { toast } from "sonner";

export function PlanCard({ plan }: { plan: PlanId }) {
  const isPro = plan === "pro";
  const pro = PLANS.pro;

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Plan</p>
            <p className="text-xs text-muted-foreground">
              {isPro ? "You're on Pro — thank you!" : "You're on the Free plan"}
            </p>
          </div>
          <span
            className={
              isPro
                ? "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        {!isPro && (
          <div className="mt-4">
            <FormSheet
              title="Upgrade to Pro"
              trigger={
                <Button className="w-full">
                  <SparklesIcon className="size-4" /> Upgrade to Pro
                </Button>
              }
            >
              {() => (
                <div className="space-y-4">
                  <div>
                    <p className="font-display text-2xl">
                      ₱{monthlyEquivalent(pro).toLocaleString("en-PH")}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        /mo
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₱{pro.priceYearly.toLocaleString("en-PH")} billed yearly ·
                      or ₱{pro.priceMonthly.toLocaleString("en-PH")}/mo
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm">
                    {pro.features
                      .filter((f) => !f.startsWith("Everything"))
                      .map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                            <CheckIcon className="size-3.5" />
                          </span>
                          {f}
                        </li>
                      ))}
                  </ul>

                  <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                    💳 Pro billing launches soon — pay with{" "}
                    <span className="font-medium text-foreground">
                      GCash, Maya, cards, or bank transfer
                    </span>{" "}
                    via Xendit.
                  </div>

                  <Button
                    className="w-full"
                    onClick={() =>
                      toast("Pro billing is launching soon", {
                        description:
                          "You'll be able to pay with GCash, Maya, and cards.",
                      })
                    }
                  >
                    Notify me when Pro is ready
                  </Button>
                </div>
              )}
            </FormSheet>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
