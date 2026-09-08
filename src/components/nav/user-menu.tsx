"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, UserCogIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/components/providers/profile-provider";
import { initialsFrom } from "@/lib/initials";
import { cn } from "@/lib/utils";

/**
 * Account control: an initials avatar that opens the identity + account +
 * sign-out menu. Used in the mobile top bar and in the desktop sidebar footer.
 *
 * On mobile the trigger is icon-only and the name lives inside the menu - at
 * 320px a name beside the brand pushes the brand off screen. The sidebar has a
 * dedicated full-width row, so it opts into `showName`.
 *
 * `email` is a prop because the profile row has no email column; it belongs to
 * the Supabase auth user, which only the server can read.
 */
export function UserMenu({
  email,
  showName = false,
  className,
}: {
  email: string | null;
  /** Render the display name beside the avatar (sidebar footer only). */
  showName?: boolean;
  className?: string;
}) {
  const profile = useProfile();
  const name = profile.display_name?.trim() || "Your account";
  // Falling back to the email's first letter rather than "?" - an account with
  // no display name still has an address, and "?" next to a real name in the
  // menu below reads like a rendering fault.
  const initials = initialsFrom(
    profile.display_name,
    email?.trim()?.[0]?.toUpperCase(),
  );

  // A DropdownMenuItem is a Radix <div role="menuitem">, not a <button
  // type="submit">, so it cannot submit a form on its own - and the menu
  // content is portalled and unmounts the instant an item is selected, so a
  // submit button nested inside it would be torn out of the document before
  // the browser acted on the click. Keeping the form OUTSIDE the menu and
  // calling requestSubmit() sidesteps both problems while still using the
  // existing POST /auth/signout route (it clears the httpOnly session cookie,
  // which client-side JS cannot do).
  const signOutForm = React.useRef<HTMLFormElement>(null);
  const signOut = React.useCallback(() => {
    const form = signOutForm.current;
    if (!form) return;
    try {
      form.requestSubmit();
    } catch {
      // requestSubmit() only landed in Safari 16 (Sept 2022); on iOS 15 and
      // older it throws and Log out would silently do nothing. submit() is
      // the ancient equivalent - it skips validation, which this form has
      // none of anyway.
      form.submit();
    }
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // Only when the name is hidden: an aria-label on a button whose
            // visible text is the user's name would override that text and
            // break "label in name" for voice control.
            aria-label={showName ? undefined : "Account menu"}
            className={cn(
              "relative flex shrink-0 items-center gap-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // Widens the thumb target to 44px without moving the 36px
              // visual; see the same treatment in privacy-toggle.tsx.
              "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
              showName && "w-full gap-2 pr-1",
              className,
            )}
          >
            {/* Hidden from AT: "KG" read aloud is noise beside the name (or
                the button's own label when the name is hidden). */}
            <Avatar className="size-8 shrink-0" aria-hidden>
              <AvatarFallback className="bg-sage-soft text-xs font-semibold text-sage">
                {initials}
              </AvatarFallback>
            </Avatar>
            {showName && (
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
                {name}
              </span>
            )}
            <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
          </button>
        </DropdownMenuTrigger>

        {/* Anchored to whichever edge the trigger sits against: "end" for the
            top-right header button (keeps a 224px menu inside a 320px
            viewport), "start" for the sidebar footer, where an end-aligned
            menu would run off the left edge and have to be collision-shifted
            back. The width is set explicitly because DropdownMenuContent
            otherwise inherits the trigger's width. */}
        <DropdownMenuContent
          align={showName ? "start" : "end"}
          collisionPadding={8}
          className="w-56"
        >
          <DropdownMenuLabel className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            {email && (
              <p className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </p>
            )}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="px-2 py-2">
            <Link href="/account">
              <UserCogIcon className="size-4" aria-hidden />
              Account &amp; subscription
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="px-2 py-2" onSelect={signOut}>
            <LogOutIcon className="size-4" aria-hidden />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deliberately a sibling of the menu rather than a child: see the
          comment on signOutForm above. */}
      <form ref={signOutForm} action="/auth/signout" method="post" hidden />
    </>
  );
}
