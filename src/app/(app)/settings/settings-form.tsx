"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySymbol } from "@/lib/format";
import { updateSettings } from "@/app/(app)/settings/actions";
import type { Profile } from "@/lib/supabase/types";
import { toast } from "sonner";

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"];
const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "UTC",
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState(
    profile.display_name ?? "",
  );
  const [currency, setCurrency] = React.useState(profile.currency);
  const [timezone, setTimezone] = React.useState(profile.timezone);
  const [weekStartsOn, setWeekStartsOn] = React.useState<"monday" | "sunday">(
    profile.week_starts_on,
  );
  const [threshold, setThreshold] = React.useState(
    String(profile.low_balance_threshold),
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!displayName.trim()) return toast.error("Enter your name.");
    setSaving(true);
    const result = await updateSettings({
      displayName,
      currency,
      timezone,
      weekStartsOn,
      lowBalanceThreshold: Number.parseFloat(threshold) || 0,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Name</Label>
        <Input
          id="s-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-currency">Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger id="s-currency" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {currencySymbol(c)} {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-tz">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="s-tz" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-week">Week starts on</Label>
        <Select
          value={weekStartsOn}
          onValueChange={(v) => setWeekStartsOn(v as "monday" | "sunday")}
        >
          <SelectTrigger id="s-week" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monday">Monday</SelectItem>
            <SelectItem value="sunday">Sunday</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-threshold">Low-balance alert threshold</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="s-threshold"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
            className="pl-7 tnum"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Spending accounts below this show a low-balance alert.
        </p>
      </div>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save settings
      </Button>
    </div>
  );
}
