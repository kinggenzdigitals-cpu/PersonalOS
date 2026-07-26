import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getMyFeedback } from "@/lib/queries/feedback";
import { FeedbackView } from "@/components/feedback/feedback-view";

export const metadata: Metadata = { title: "Feedback & Recommendations" };

export default async function FeedbackPage() {
  await requireOnboardedProfile();
  const mine = await getMyFeedback();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">
          Feedback &amp; Recommendations
        </h1>
        <p className="text-sm text-muted-foreground">
          Report a bug, request a feature, or share an idea.
        </p>
      </header>
      <FeedbackView initial={mine} />
    </div>
  );
}
