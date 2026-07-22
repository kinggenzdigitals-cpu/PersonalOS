"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Bottom sheet that renders a form. `children` is a render function receiving a
 * `close` callback so the form can dismiss the sheet when it finishes.
 */
export function FormSheet({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="font-display">{title}</SheetTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </SheetHeader>
        <div className="p-4 pt-2">{children(() => setOpen(false))}</div>
      </SheetContent>
    </Sheet>
  );
}
