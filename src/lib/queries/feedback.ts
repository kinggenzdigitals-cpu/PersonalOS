import { createClient } from "@/lib/supabase/server";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/supabase/types";

export type MyFeedback = {
  id: string;
  category: FeedbackCategory;
  title: string;
  message: string;
  screenshot_url: string | null;
  status: FeedbackStatus;
  admin_response: string | null;
  created_at: string;
};

/** The signed-in user's own submissions (never exposes internal admin notes). */
export async function getMyFeedback(): Promise<MyFeedback[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, category, title, message, screenshot_url, status, admin_response, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data as MyFeedback[] | null) ?? [];
}
