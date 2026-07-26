import type { FeedbackCategory, FeedbackStatus } from "@/lib/supabase/types";

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug report",
  feature: "Feature request",
  recommendation: "Recommendation",
  other: "Other feedback",
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
};

/** Tailwind classes for a status badge. */
export const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  new: "bg-secondary text-muted-foreground",
  under_review: "bg-brand-2/15 text-brand-2",
  planned: "bg-brand/10 text-brand",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  declined: "bg-error/10 text-error",
};

export const CATEGORY_ORDER: FeedbackCategory[] = [
  "bug",
  "feature",
  "recommendation",
  "other",
];

export const STATUS_ORDER: FeedbackStatus[] = [
  "new",
  "under_review",
  "planned",
  "in_progress",
  "completed",
  "declined",
];
