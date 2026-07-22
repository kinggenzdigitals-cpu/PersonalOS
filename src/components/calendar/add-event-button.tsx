"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { EventForm } from "@/components/calendar/event-form";

export function AddEventButton() {
  return (
    <FormSheet
      title="New event"
      trigger={
        <Button variant="outline" className="w-full">
          <PlusIcon className="size-4" /> Add event
        </Button>
      }
    >
      {(close) => <EventForm onDone={close} />}
    </FormSheet>
  );
}
