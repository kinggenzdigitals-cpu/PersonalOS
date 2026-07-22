"use client";

import * as React from "react";
import { FormSheet } from "@/components/money/form-sheet";
import { MoodForm } from "@/components/habits/mood-form";
import type { MoodEntry } from "@/lib/supabase/types";

/**
 * Opens the mood check-in sheet. Provide either a `trigger` (uncontrolled) or
 * `open`/`onOpenChange` (controlled, e.g. from the dashboard chip or Quick Add).
 */
export function MoodCheckIn({
  entryDate,
  initial,
  trigger,
  open,
  onOpenChange,
}: {
  entryDate: string;
  initial?: MoodEntry | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <FormSheet
      title={initial ? "Update today's check-in" : "How are you today?"}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
    >
      {(close) => (
        <MoodForm initial={initial} entryDate={entryDate} onDone={close} />
      )}
    </FormSheet>
  );
}
