import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getLedgerSummary, getLedgerEntries } from "@/lib/queries/ledger";
import { localDateKey } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HandCoinsIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LedgerCard } from "@/components/money/ledger-card";
import { AddLedgerButton } from "@/components/money/add-ledger-button";

export const metadata: Metadata = { title: "Receivables & Payables" };

export default async function OwedPage() {
  const profile = await requireOnboardedProfile();
  const today = localDateKey(profile.timezone);
  const currency = profile.currency;

  const [summary, receivables, payables] = await Promise.all([
    getLedgerSummary(profile.timezone),
    getLedgerEntries("receivable", false),
    getLedgerEntries("payable", false),
  ]);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Receivable"
          value={formatMoney(summary.totalReceivable, currency)}
          sub="Owed to you"
          tone="up"
        />
        <StatCard
          label="Overdue"
          value={formatMoney(summary.overdueReceivable, currency)}
          sub="Past due date"
          tone={summary.overdueReceivable > 0 ? "warn" : "muted"}
        />
        <StatCard
          label="Total Payable"
          value={formatMoney(summary.totalPayable, currency)}
          sub="You owe"
          tone="down"
        />
        <StatCard
          label="Overdue"
          value={formatMoney(summary.overduePayable, currency)}
          sub="Past due date"
          tone={summary.overduePayable > 0 ? "warn" : "muted"}
        />
      </div>

      {/* Receivables */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Receivables</h2>
          <span className="text-xs text-muted-foreground">Owed to you</span>
        </div>
        {receivables.length === 0 ? (
          <EmptyState
            icon={HandCoinsIcon}
            title="Nothing outstanding"
            description="Track money customers or people owe you."
            action={<AddLedgerButton defaultDirection="receivable" label="Add receivable" />}
          />
        ) : (
          <>
            <div className="space-y-2">
              {receivables.map((e) => (
                <LedgerCard key={e.id} entry={e} today={today} />
              ))}
            </div>
            <AddLedgerButton defaultDirection="receivable" label="Add receivable" />
          </>
        )}
      </section>

      {/* Payables */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Payables</h2>
          <span className="text-xs text-muted-foreground">You owe</span>
        </div>
        {payables.length === 0 ? (
          <EmptyState
            icon={HandCoinsIcon}
            title="Nothing to pay"
            description="Track money you owe suppliers or people."
            action={<AddLedgerButton defaultDirection="payable" label="Add payable" />}
          />
        ) : (
          <>
            <div className="space-y-2">
              {payables.map((e) => (
                <LedgerCard key={e.id} entry={e} today={today} />
              ))}
            </div>
            <AddLedgerButton defaultDirection="payable" label="Add payable" />
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "up" | "down" | "warn" | "muted";
}) {
  const toneClass =
    tone === "up"
      ? "text-money-up"
      : tone === "down"
        ? "text-money-down"
        : tone === "warn"
          ? "text-warning"
          : "text-foreground";
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("tnum mt-1 font-display text-xl", toneClass)}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
