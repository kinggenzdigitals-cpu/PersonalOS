"use client";

import * as React from "react";
import { useUpgrade } from "@/components/providers/upgrade-provider";

const ACTIVE_KEY = "fht-active-seconds";
const SHOWN_KEY = "fht-upgrade-shown";
const THRESHOLD = 300; // 5 minutes of active use
const IDLE_MS = 60_000; // pause after 60s idle

/**
 * Counts genuine active use (tab visible + not idle) and, once it reaches five
 * minutes, opens the upgrade modal a single time for eligible users. The total
 * is persisted so a refresh doesn't reset it, and it pauses when the tab is
 * hidden or the user goes idle. Shown at most once (no nagging).
 */
export function ActiveUseTimer({ eligible }: { eligible: boolean }) {
  const { promptUpgrade } = useUpgrade();
  const lastActivity = React.useRef(0);

  React.useEffect(() => {
    if (!eligible || typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(SHOWN_KEY) === "1") return;
    } catch {
      return;
    }

    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "pointermove", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const id = window.setInterval(() => {
      // Only count while the tab is visible and the user is not idle.
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity.current > IDLE_MS) return;

      let secs = 0;
      try {
        secs = Number.parseInt(window.localStorage.getItem(ACTIVE_KEY) ?? "0", 10) || 0;
      } catch {
        secs = 0;
      }
      secs += 1;
      try {
        window.localStorage.setItem(ACTIVE_KEY, String(secs));
      } catch {
        /* ignore */
      }

      if (secs >= THRESHOLD) {
        try {
          window.localStorage.setItem(SHOWN_KEY, "1");
        } catch {
          /* ignore */
        }
        window.clearInterval(id);
        events.forEach((e) => window.removeEventListener(e, bump));
        promptUpgrade(
          "You've been getting a lot done! Upgrade to Pro or Premium for higher limits, longer report history, and more automation.",
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [eligible, promptUpgrade]);

  return null;
}
