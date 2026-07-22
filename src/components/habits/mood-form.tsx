"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MOOD_FACES } from "@/lib/constants";
import { upsertMoodEntry } from "@/app/(app)/habits/mood-actions";
import type { MoodEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

export function MoodForm({
  initial,
  entryDate,
  onDone,
}: {
  initial?: MoodEntry | null;
  entryDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [mood, setMood] = React.useState<number | null>(initial?.mood ?? null);
  const [energy, setEnergy] = React.useState<number>(initial?.energy ?? 3);
  const [stress, setStress] = React.useState<number>(initial?.stress ?? 3);
  const [gratitude, setGratitude] = React.useState(initial?.gratitude ?? "");
  const [wins, setWins] = React.useState(initial?.wins ?? "");
  const [struggles, setStruggles] = React.useState(initial?.struggles ?? "");
  const [prayer, setPrayer] = React.useState(initial?.prayer_requests ?? "");
  const [journal, setJournal] = React.useState(initial?.journal ?? "");
  const [showMore, setShowMore] = React.useState(
    Boolean(
      initial?.gratitude ||
        initial?.wins ||
        initial?.struggles ||
        initial?.prayer_requests ||
        initial?.journal,
    ),
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!mood) return toast.error("Pick how you're feeling.");
    setSaving(true);
    const result = await upsertMoodEntry({
      entryDate,
      mood,
      energy,
      stress,
      gratitude,
      wins,
      struggles,
      prayerRequests: prayer,
      journal,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Mood saved");
  }

  return (
    <div className="space-y-5">
      {/* Mood faces */}
      <div className="flex justify-between gap-1">
        {MOOD_FACES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setMood(f.value)}
            aria-pressed={mood === f.value}
            aria-label={f.label}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all",
              mood === f.value
                ? "bg-brand/10 ring-2 ring-brand"
                : "hover:bg-secondary",
            )}
          >
            <span className="text-2xl">{f.emoji}</span>
            <span className="text-[10px] text-muted-foreground">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Energy & stress */}
      <div className="space-y-4">
        <SliderRow
          label="Energy"
          value={energy}
          onChange={setEnergy}
          leftLabel="Drained"
          rightLabel="Energized"
        />
        <SliderRow
          label="Stress"
          value={stress}
          onChange={setStress}
          leftLabel="Calm"
          rightLabel="Tense"
        />
      </div>

      {/* More */}
      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronDownIcon
          className={cn("size-4 transition-transform", showMore && "rotate-180")}
        />
        Add more
      </button>

      {showMore && (
        <div className="space-y-3 rounded-xl bg-secondary/50 p-3">
          <Field label="Gratitude" value={gratitude} onChange={setGratitude} />
          <Field label="Wins" value={wins} onChange={setWins} />
          <Field label="Struggles" value={struggles} onChange={setStruggles} />
          <Field
            label="Prayer requests"
            value={prayer}
            onChange={setPrayer}
          />
          <Field label="Journal" value={journal} onChange={setJournal} rows={3} />
        </div>
      )}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save check-in
      </Button>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tnum text-muted-foreground">{value}/5</span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder="Optional"
      />
    </div>
  );
}
