import { WalletCardsIcon } from "lucide-react";
import { MoneyTabs } from "@/components/money/money-tabs";
import { AddTransactionButton } from "@/components/money/add-transaction-button";

export default function MoneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="money-shell relative isolate space-y-6">
      <div className="money-ambient" aria-hidden />
      <header className="money-hero flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-card sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="money-hero-icon grid size-11 shrink-0 place-items-center rounded-xl">
            <WalletCardsIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-2">
              Finance workspace
            </p>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              Money
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Accounts, spending, plans and goals in one clear view.
            </p>
          </div>
        </div>
        <AddTransactionButton />
      </header>
      <MoneyTabs />
      <div className="money-page">{children}</div>
    </div>
  );
}
