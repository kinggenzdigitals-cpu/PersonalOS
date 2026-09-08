"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { usePrivacyHidden } from "@/components/ui/money";
import { toggleHidden } from "@/lib/privacy-store";
import { cn } from "@/lib/utils";

/**
 * Header control for "hide sensitive info".
 *
 * Icon-only: the mobile top bar has to fit the brand, this, and the account
 * menu at 320px, so the state is carried by the icon plus aria-pressed rather
 * than a text label that would crowd the brand out.
 *
 * State lives in the shared privacy store (localStorage, mirrored onto a data
 * attribute by a pre-paint script in the root layout), so the choice survives
 * navigation and refresh with no flash of un-masked amounts.
 */
export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = usePrivacyHidden();

  return (
    <button
      type="button"
      onClick={toggleHidden}
      // A toggle button's accessible name must NOT change with its state,
      // because aria-pressed already carries the state. An earlier revision
      // flipped both, and the two cancelled out: with amounts masked a screen
      // reader announced "Show sensitive information … pressed", i.e. that
      // *showing* was the state in effect — the exact inverse of the truth.
      aria-pressed={hidden}
      aria-label="Hide sensitive information"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // The visual stays 36px to match the header's other controls, but a
        // 36px thumb target in a top bar is below the 44px this app uses in
        // its bottom nav. The pseudo-element widens only the hit area, so
        // nothing shifts and the bordered variant in Settings keeps its 36px
        // ring.
        "after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        className,
      )}
    >
      {hidden ? (
        <EyeOffIcon className="size-5" aria-hidden />
      ) : (
        <EyeIcon className="size-5" aria-hidden />
      )}
    </button>
  );
}
