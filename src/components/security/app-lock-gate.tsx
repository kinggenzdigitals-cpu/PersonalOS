"use client";

import * as React from "react";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PIN_HASH_KEY = "fht-app-lock-hash";
const UNLOCKED_KEY = "fht-app-lock-unlocked";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AppLockGate() {
  const [locked, setLocked] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // While locked, everything else on the page is inert: out of the tab order
  // and out of the accessibility tree, so neither Tab nor a screen reader's
  // virtual cursor can reach the balances behind the overlay. It walks up to
  // <body> so the root layout's toaster and any portals are covered too, and
  // only releases the elements it inerted itself.
  React.useEffect(() => {
    if (!locked) return;
    const changed: HTMLElement[] = [];
    for (
      let node: HTMLElement | null = rootRef.current;
      node && node !== document.body;
      node = node.parentElement
    ) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          changed.push(sibling);
        }
      }
    }
    return () => {
      for (const el of changed) el.inert = false;
    };
  }, [locked]);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const hasPin = Boolean(window.localStorage.getItem(PIN_HASH_KEY));
        const unlocked = window.sessionStorage.getItem(UNLOCKED_KEY) === "1";
        setLocked(hasPin && !unlocked);
      } catch {
        setLocked(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function unlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const expected = window.localStorage.getItem(PIN_HASH_KEY);
      if (!expected) {
        setLocked(false);
        return;
      }
      const actual = await sha256(pin);
      if (actual !== expected) {
        setError("That PIN does not match.");
        return;
      }
      window.sessionStorage.setItem(UNLOCKED_KEY, "1");
      setLocked(false);
    } catch {
      setError("The app lock could not be checked in this browser.");
    }
  }

  if (!locked) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-title"
      aria-describedby="app-lock-description"
      className="fixed inset-0 z-[100] grid place-items-center bg-background/95 px-4 backdrop-blur"
    >
      <form
        onSubmit={unlock}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <div className="space-y-1 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-secondary text-brand">
            <LockIcon className="size-5" aria-hidden />
          </span>
          <h2 id="app-lock-title" className="font-display text-xl tracking-tight">
            App locked
          </h2>
          <p id="app-lock-description" className="text-sm text-muted-foreground">
            Enter your local PIN to view your finance and mood data on this device.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="app-lock-pin" className="text-sm font-medium">
            PIN
          </label>
          <Input
            id="app-lock-pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full">
          Unlock
        </Button>
      </form>
    </div>
  );
}
