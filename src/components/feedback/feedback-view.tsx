"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MessageSquarePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitFeedback } from "@/app/(app)/feedback/actions";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STATUS_LABELS,
  STATUS_CLASSES,
} from "@/lib/feedback";
import type { MyFeedback } from "@/lib/queries/feedback";
import type { FeedbackCategory } from "@/lib/supabase/types";

export function FeedbackView({ initial }: { initial: MyFeedback[] }) {
  const router = useRouter();
  const [category, setCategory] = React.useState<FeedbackCategory>("bug");
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [screenshot, setScreenshot] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await submitFeedback({
      category,
      title,
      message,
      screenshotUrl: screenshot || null,
    });
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    toast.success("Thanks! Your feedback was submitted.");
    setTitle("");
    setMessage("");
    setScreenshot("");
    setCategory("bug");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORY_ORDER.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                      category === c
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fb-title" className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fb-msg" className="text-xs font-medium text-muted-foreground">
                Details
              </label>
              <Textarea
                id="fb-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened, or what would you like to see?"
                rows={4}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fb-shot" className="text-xs font-medium text-muted-foreground">
                Screenshot link (optional)
              </label>
              <Input
                id="fb-shot"
                type="url"
                value={screenshot}
                onChange={(e) => setScreenshot(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <MessageSquarePlusIcon className="size-4" aria-hidden />
              )}
              Submit feedback
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="font-display text-lg">Your submissions</h2>
        {initial.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            You haven&apos;t submitted anything yet.
          </p>
        ) : (
          initial.map((f) => (
            <Card key={f.id} className="shadow-soft">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[f.category]} ·{" "}
                      {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_CLASSES[f.status],
                    )}
                  >
                    {STATUS_LABELS[f.status]}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {f.message}
                </p>
                {f.admin_response && (
                  <div className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm">
                    <p className="mb-0.5 text-xs font-medium text-brand">
                      Response
                    </p>
                    {f.admin_response}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
