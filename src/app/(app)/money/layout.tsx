import { MoneyTabs } from "@/components/money/money-tabs";

export default function MoneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl tracking-tight">Money</h1>
      </header>
      <MoneyTabs />
      {children}
    </div>
  );
}
