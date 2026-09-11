"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getSiteURL } from "@/lib/site";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = React.useState(false);

  async function signIn() {
    setLoading(true);
    try {
      const supabase = createClient();
      const params = next ? `?next=${encodeURIComponent(next)}` : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteURL()}/auth/callback${params}`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) {
        toast.error(friendlyAuthError(error.message));
        setLoading(false);
      }
      // On success the browser redirects to Google; keep the loading state.
    } catch {
      toast.error(friendlyAuthError("Failed to fetch"));
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={signIn}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Connecting to Google…
        </>
      ) : (
        <>
          <Image src="/google-signin-g.svg" width={18} height={18} alt="" aria-hidden />
          Continue with Google
        </>
      )}
    </Button>
  );
}
