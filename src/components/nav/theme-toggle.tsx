"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch, icon-only, sized to sit beside the privacy toggle.
 *
 * The icon names the mode you GET by pressing — a sun in dark mode, a moon in
 * light — rather than the mode you are in. That is what people reach for.
 *
 * The two icons are swapped purely by the `dark:` CSS variant. The server
 * does not know the stored preference, so reading `resolvedTheme` to pick an
 * icon would render one thing on the server and another after hydration; CSS
 * follows the class next-themes stamps before first paint, so there is no
 * mismatch and no flicker.
 *
 * The accessible name is static on purpose. A name that flipped with the
 * state would tell a screen reader the opposite of the truth at the moment
 * the state changed, and there is no aria-pressed here because this is a
 * mode switch, not an on/off toggle.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Switch between light and dark mode"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // 36px visual, 44px hit area — same treatment as privacy-toggle.tsx.
        "after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        className,
      )}
    >
      <SunIcon className="hidden size-5 dark:block" aria-hidden />
      <MoonIcon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}
