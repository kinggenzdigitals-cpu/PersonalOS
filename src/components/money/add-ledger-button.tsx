"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { LedgerForm } from "@/components/money/ledger-form";
import type { LedgerDirection } from "@/lib/supabase/types";

export function AddLedgerButton({
  defaultDirection = "receivable",
  label = "Add entry",
  variant = "outline",
}: {
  defaultDirection?: LedgerDirection;
  label?: string;
  variant?: "outline" | "default";
}) {
  return (
    <FormSheet
      title="New entry"
      trigger={
        <Button variant={variant} className="w-full">
          <PlusIcon className="size-4" /> {label}
        </Button>
      }
    >
      {(close) => (
        <LedgerForm defaultDirection={defaultDirection} onDone={close} />
      )}
    </FormSheet>
  );
}
