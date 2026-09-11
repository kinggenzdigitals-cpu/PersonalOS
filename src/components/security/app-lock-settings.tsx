"use client";

import * as React from "react";
import { LockIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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

export function AppLockSettings() {
  const [enabled, setEnabled] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setEnabled(Boolean(window.localStorage.getItem(PIN_HASH_KEY)));
      } catch {
        setEnabled(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function savePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pin.trim().length < 4) {
      toast.error("Use at least 4 digits or characters for the app lock PIN.");
      return;
    }
    setSaving(true);
    try {
      const hash = await sha256(pin.trim());
      window.localStorage.setItem(PIN_HASH_KEY, hash);
      window.sessionStorage.setItem(UNLOCKED_KEY, "1");
      setEnabled(true);
      setPin("");
      toast.success("App lock enabled on this device.");
    } catch {
      toast.error("This browser could not save the app lock.");
    } finally {
      setSaving(false);
    }
  }

  function removePin() {
    try {
      window.localStorage.removeItem(PIN_HASH_KEY);
      window.sessionStorage.removeItem(UNLOCKED_KEY);
      setEnabled(false);
      setPin("");
      toast.success("App lock removed from this device.");
    } catch {
      toast.error("This browser could not remove the app lock.");
    }
  }

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-brand">
            {enabled ? (
              <ShieldCheckIcon className="size-5" aria-hidden />
            ) : (
              <LockIcon className="size-5" aria-hidden />
            )}
          </span>
          <div>
            <p className="text-sm font-medium">Local app lock</p>
            <p className="text-xs text-muted-foreground">
              Add a PIN on this browser or phone before showing finance and mood data.
            </p>
          </div>
        </div>

        <form onSubmit={savePin} className="space-y-2">
          <label htmlFor="local-app-pin" className="text-xs font-medium text-muted-foreground">
            {enabled ? "Change PIN" : "Set PIN"}
          </label>
          <div className="flex gap-2">
            <Input
              id="local-app-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="At least 4 digits"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>

        {enabled && (
          <Button type="button" variant="outline" className="w-full" onClick={removePin}>
            Remove app lock on this device
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
