import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getBankingWorkspace } from "@/lib/queries/banking";
import { BankConnections } from "@/components/money/bank-connections";

export const metadata: Metadata = { title: "Bank connections" };

export default async function BankConnectionsPage() {
  const profile = await requireOnboardedProfile();
  const workspace = await getBankingWorkspace();
  return <BankConnections {...workspace} currency={profile.currency} timezone={profile.timezone} />;
}
