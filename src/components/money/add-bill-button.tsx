"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { BillForm } from "@/components/money/bill-form";

export function AddBillButton() {
  return (
    <FormSheet
      title="New bill"
      trigger={
        <Button variant="outline" className="w-full">
          <PlusIcon className="size-4" /> Add bill
        </Button>
      }
    >
      {(close) => <BillForm onDone={close} />}
    </FormSheet>
  );
}
