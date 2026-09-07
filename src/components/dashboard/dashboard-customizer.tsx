"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormSheet } from "@/components/money/form-sheet";
import { DASHBOARD_CARDS, isCardVisible } from "@/lib/dashboard-cards";
import { updateDashboardPrefs } from "@/app/(app)/settings/actions";
import type { DashboardPrefs } from "@/lib/supabase/types";
import { toast } from "sonner";

/** Lets the user choose which Home cards are shown. Saved per user. */
export function DashboardCustomizer({ prefs }: { prefs: DashboardPrefs }) {
  return (
    <FormSheet
      title="Customise dashboard"
      description="Choose what appears on your Home screen."
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <SlidersHorizontalIcon className="size-3.5" aria-hidden />
          Customise
        </button>
      }
    >
      {(close) => <CustomizerForm prefs={prefs} onDone={close} />}
    </FormSheet>
  );
}

function CustomizerForm({
  prefs,
  onDone,
}: {
  prefs: DashboardPrefs;
  onDone: () => void;
}) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState<string[]>(prefs.hidden ?? []);
  const [saving, setSaving] = React.useState(false);

  function toggle(key: string, visible: boolean) {
    setHidden((prev) =>
      visible ? prev.filter((k) => k !== key) : [...new Set([...prev, key])],
    );
  }

  async function save() {
    setSaving(true);
    const result = await updateDashboardPrefs(hidden);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Dashboard updated");
  }

  const groups = ["Money", "Life"] as const;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          {DASHBOARD_CARDS.filter((c) => c.group === group).map((card) => {
            const visible = isCardVisible(card.key, { hidden });
            return (
              <div
                key={card.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`card-${card.key}`}>{card.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </div>
                <Switch
                  id={`card-${card.key}`}
                  checked={visible}
                  onCheckedChange={(v) => toggle(card.key, v)}
                />
              </div>
            );
          })}
        </div>
      ))}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save
      </Button>
    </div>
  );
}
