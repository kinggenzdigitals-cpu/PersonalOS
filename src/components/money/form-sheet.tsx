"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Max-width per size (spec: sm≤400, md≤520, lg≤640). */
const SIZE_CLASS = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[640px]",
} as const;

/**
 * Centered modal that renders a form. `children` is a render function receiving
 * a `close` callback so the form can dismiss the modal when it finishes.
 *
 * Built on the shared Dialog: centered horizontally + vertically, dark overlay,
 * background scroll locked, Escape / X / Cancel to close, focus returns to the
 * trigger. On mobile it keeps ~16px side gutters and never overflows the screen;
 * the title stays visible while the body scrolls.
 */
export function FormSheet({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange,
  size = "md",
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "sm" | "md" | "lg";
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn("flex max-h-[85vh] flex-col gap-0 p-0", SIZE_CLASS[size])}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children(() => setOpen(false))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
