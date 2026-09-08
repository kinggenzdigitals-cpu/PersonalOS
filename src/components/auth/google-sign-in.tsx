import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/auth/google-button";
import { googleProviderState } from "@/lib/auth-providers";

/**
 * The Google button and its "or" divider, rendered only when Supabase says the
 * provider is on.
 *
 * Render this inside a `<Suspense>` boundary. The lookup is a network call, and
 * without a boundary its worst case (a Supabase host that accepts the
 * connection and never answers) is paid as blank-screen TTFB on the two pages a
 * locked-out user needs most — failed fetches are never written to the Data
 * Cache, so a cold cache re-pays it on every single render for the length of
 * the outage. Behind a boundary the email form ships in the static shell and
 * this streams in after it, so the cost is a button that arrives late.
 *
 * Both auth pages share this component so the gating rule and its reasoning
 * live in exactly one place.
 */
export async function GoogleSignIn({ next }: { next?: string }) {
  // Only an explicit yes shows the button. If the provider is off, a rendered
  // button could only ever error; if we could not reach Supabase to ask, hiding
  // is still the safer miss, because email sign-in always works and nobody has
  // a Google-only account yet (the provider has never been enabled). Revisit
  // once Google is live and people have signed up through it — from then on a
  // transient hide locks those users out and showing becomes the better miss.
  if ((await googleProviderState()) !== "enabled") return null;

  return (
    <>
      <GoogleButton next={next} />

      {/* The divider is part of the same unit: on its own above the form it
          would read as a separator between nothing and the form. */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
    </>
  );
}
