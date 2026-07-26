import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getNetWorth } from "@/lib/queries/networth";
import { hasProFeature } from "@/lib/plan-guard";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { NetWorthSection } from "@/components/money/networth-section";
import { ProGate } from "@/components/settings/pro-gate";

export const metadata: Metadata = { title: "Net Worth" };

export default async function NetWorthPage() {
  const profile = await requireOnboardedProfile();

  if (!(await hasProFeature("netWorth"))) {
    return (
      <ProGate
        title="Track your true net worth"
        description="See everything you own minus everything you owe — a complete picture of your wealth over time."
        bullets={[
          "Add assets: property, investments, vehicles & more",
          "Track liabilities: loans, mortgages, credit cards",
          "Net worth combines cash, assets, debts & what you're owed",
        ]}
      />
    );
  }

  const nw = await getNetWorth(profile.timezone);
  const currency = profile.currency;

  // Distribution: liquid (cash) vs non-liquid (assets)
  const positive = Math.max(nw.liquid, 0) + Math.max(nw.assetsTotal, 0);
  const liquidPct = positive > 0 ? (nw.liquid / positive) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Total net worth */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total net worth
          </p>
          <p
            className={cn(
              "tnum font-display text-3xl",
              nw.netWorth < 0 && "text-money-down",
            )}
          >
            <Money value={nw.netWorth} currency={currency} />
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Everything you own minus everything you owe
          </p>

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row
              label="Cash (liquid)"
              value={<Money value={nw.liquid} currency={currency} />}
            />
            <Row
              label="Assets (non-liquid)"
              value={<Money value={nw.assetsTotal} currency={currency} />}
            />
            <Row
              label="Owed to you"
              value={<Money value={nw.receivable} currency={currency} />}
              tone="up"
            />
            <Row
              label="You owe"
              value={
                <>
                  − <Money value={nw.payable} currency={currency} />
                </>
              }
              tone="down"
            />
            <Row
              label="Liabilities"
              value={
                <>
                  − <Money value={nw.liabilitiesTotal} currency={currency} />
                </>
              }
              tone="down"
            />
          </dl>

          {positive > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Liquid {Math.round(liquidPct)}%</span>
                <span>Non-liquid {Math.round(100 - liquidPct)}%</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-sage"
                  style={{ width: `${liquidPct}%` }}
                />
                <div
                  className="h-full bg-brand"
                  style={{ width: `${100 - liquidPct}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NetWorthSection type="asset" items={nw.assets} />
      <NetWorthSection type="liability" items={nw.liabilities} />
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tnum font-medium",
          tone === "up" && "text-money-up",
          tone === "down" && "text-money-down",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
