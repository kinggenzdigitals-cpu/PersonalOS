import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/auth/google-button";

/**
 * Google is a permanent sign-in method now that accounts can be created with
 * it. Render it immediately: asking Supabase for provider settings first can
 * delay or hide the only valid route back into a Google-created account.
 */
export function GoogleSignIn({
  next,
  returning = false,
}: {
  next?: string;
  returning?: boolean;
}) {
  return (
    <>
      <GoogleButton next={next} />

      {returning && (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Used Google before? Choose the same Google account — no password
          needed.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
    </>
  );
}
