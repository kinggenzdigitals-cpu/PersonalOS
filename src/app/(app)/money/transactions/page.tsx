import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getTransactions } from "@/lib/queries/money";
import { TransactionsView } from "@/components/money/transactions-view";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const profile = await requireOnboardedProfile();
  const initial = await getTransactions({ limit: 50, offset: 0 });

  return <TransactionsView initial={initial} timezone={profile.timezone} />;
}
