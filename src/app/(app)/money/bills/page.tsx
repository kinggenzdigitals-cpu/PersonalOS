import type { Metadata } from "next";
import { CalendarClockIcon, ReceiptTextIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getBills } from "@/lib/queries/planning";
import { EmptyState } from "@/components/ui/empty-state";
import { BillCard } from "@/components/money/bill-card";
import { AddBillButton } from "@/components/money/add-bill-button";
import { MoneySectionHeading } from "@/components/money/money-section-heading";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  const profile = await requireOnboardedProfile();
  const bills = await getBills(profile.timezone, true);

  return (
    <div className="space-y-4">
      <MoneySectionHeading
        icon={CalendarClockIcon}
        title="Bills"
        description="Keep recurring payments visible before they become overdue."
        action={<AddBillButton />}
      />
      {bills.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title="No bills yet"
          description="Add recurring bills to see what's due and mark them paid in one tap."
          className="py-10"
          action={<AddBillButton />}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {bills.map((item) => (
              <BillCard key={item.bill.id} item={item} />
            ))}
          </div>
          <AddBillButton />
        </>
      )}
    </div>
  );
}
