"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackCategory } from "@/lib/supabase/types";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitFeedback(input: {
  category: FeedbackCategory;
  title: string;
  message: string;
  screenshotUrl?: string | null;
}): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) return { ok: false, error: "Add a short title." };
  if (!message) return { ok: false, error: "Describe your feedback." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category: input.category,
    title,
    message,
    screenshot_url: input.screenshotUrl?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't submit right now. Try again." };

  revalidatePath("/feedback");
  return { ok: true };
}
