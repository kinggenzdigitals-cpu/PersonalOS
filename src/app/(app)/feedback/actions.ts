"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { normalizeScreenshotUrl } from "@/lib/screenshot-url";
import type { FeedbackCategory } from "@/lib/supabase/types";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitFeedback(input: {
  category: FeedbackCategory;
  title: string;
  message: string;
  screenshotUrl?: string | null;
}): Promise<SubmitResult> {
  const active = await requireActiveUser();
  if (!active) return { ok: false, error: "You're not signed in." };
  const { supabase, user } = active;

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) return { ok: false, error: "Add a short title." };
  if (!message) return { ok: false, error: "Describe your feedback." };
  // The admin console renders this as a link, so https only.
  const screenshot = normalizeScreenshotUrl(input.screenshotUrl);
  if (!screenshot.ok) return { ok: false, error: screenshot.error };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category: input.category,
    title,
    message,
    screenshot_url: screenshot.url,
  });
  if (error) return { ok: false, error: "Couldn't submit right now. Try again." };

  revalidatePath("/feedback");
  return { ok: true };
}
