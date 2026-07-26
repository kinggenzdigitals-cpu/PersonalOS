"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { usePrivacyHidden } from "@/components/ui/money";
import { toggleHidden } from "@/lib/privacy-store";

const noopSubscribe = () => () => {};

/** Labeled light/dark + hide-sensitive controls for the sidebar footer. */
export function SidebarControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === "dark";
  const hidden = usePrivacyHidden();

  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground";

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={rowClass}
      >
        {isDark ? (
          <SunIcon className="size-[18px]" aria-hidden />
        ) : (
          <MoonIcon className="size-[18px]" aria-hidden />
        )}
        {isDark ? "Light mode" : "Dark mode"}
      </button>

      <button
        type="button"
        onClick={toggleHidden}
        aria-pressed={hidden}
        className={rowClass}
      >
        {hidden ? (
          <EyeOffIcon className="size-[18px]" aria-hidden />
        ) : (
          <EyeIcon className="size-[18px]" aria-hidden />
        )}
        {hidden ? "Show sensitive info" : "Hide sensitive info"}
      </button>
    </div>
  );
}
