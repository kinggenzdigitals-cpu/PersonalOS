import type { HabitStatus } from "@/lib/supabase/types";

export type StatusVisual = {
  label: string;
  /** tailwind classes for a small chip/dot */
  dot: string;
};

/** Visual treatment for a habit log status (area color applied separately). */
export function statusVisual(status: HabitStatus | null): StatusVisual {
  switch (status) {
    case "completed":
      return { label: "Completed", dot: "text-primary-foreground" };
    case "skipped":
      return {
        label: "Skipped",
        dot: "bg-secondary text-muted-foreground border border-border",
      };
    case "missed":
      return { label: "Missed", dot: "bg-error/15 text-error" };
    default:
      return {
        label: "Not logged",
        dot: "bg-transparent border-2 border-dashed border-border text-transparent",
      };
  }
}
