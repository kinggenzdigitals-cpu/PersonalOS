"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShuffleIcon,
  RotateCcwIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PrivacyToggle } from "@/components/nav/privacy-toggle";
import { useThemeCustomizer } from "@/components/providers/theme-customizer";
import {
  PRESETS,
  DEFAULT_COLORS,
  isValidHex,
  normalizeHex,
  readableForeground,
  type ThemeRole,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSettings({
  canCustomize = true,
}: {
  /**
   * Whether the plan includes custom brand colors. Only the palette engine is
   * gated, which is what the pricing page advertises (Free: 0 custom palettes);
   * the privacy control above it stays available on every plan.
   */
  canCustomize?: boolean;
}) {
  const {
    config,
    setEnabled,
    setRoleColor,
    addSaved,
    removeSaved,
    applyPreset,
    shuffle,
    reset,
  } = useThemeCustomizer();
  const [advanced, setAdvanced] = React.useState(false);
  // A downgraded user can still be holding an enabled palette in local
  // storage. Show the controls only when the plan allows them.
  const customActive = config.enabled && canCustomize;
  const colors = customActive ? config.colors : DEFAULT_COLORS;

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-5 pt-6">
        {/* Privacy, where the light/dark switch used to be. The app ships in
            one theme now, so the old ThemeToggle became a control that could
            not change anything — next-themes' forcedTheme makes setTheme() a
            no-op on the applied class — and leaving the row empty would have
            been odd. The same toggle also sits in the mobile top bar and the
            desktop sidebar footer; this copy is the discoverable one, and the
            only place the setting is spelled out in words. */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Hide amounts</p>
            <p className="text-xs text-muted-foreground">
              Mask balances and transaction amounts on screen.
            </p>
          </div>
          <PrivacyToggle className="border border-border" />
        </div>

        <div className="border-t border-border" />

        {/* Custom theme toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              Custom theme
              {!canCustomize && (
                <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Pro
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {canCustomize
                ? "Personalize your brand colors."
                : "Personalize your brand colors on Pro and Premium."}
            </p>
          </div>
          {canCustomize ? (
            <Switch
              checked={config.enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable custom theme"
            />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/subscription">
                <LockIcon className="size-3.5" aria-hidden /> Upgrade
              </Link>
            </Button>
          )}
        </div>

        {/* A palette left enabled from a previous paid period. The colours are
            held in local storage and still applied; say so plainly and offer a
            way out rather than silently discarding what the user chose. */}
        {!canCustomize && config.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              Colours from your previous plan are still applied. Upgrade to edit
              them again, or switch back to the default.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setEnabled(false)}>
              Use default colours
            </Button>
          </div>
        )}

        {customActive && (
          <div className="space-y-5">
            {/* Presets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Preset theme
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-2 rounded-xl border border-border p-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex -space-x-1">
                      {(["primary", "accent", "tab"] as const).map((r) => (
                        <span
                          key={r}
                          className="size-4 rounded-full border border-card"
                          style={{ backgroundColor: preset.colors[r] }}
                        />
                      ))}
                    </span>
                    <span className="truncate text-xs font-medium">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Simple color controls */}
            <div className="space-y-3">
              <ColorRow role="primary" label="Primary color" onSet={setRoleColor} value={config.colors.primary} />
              <ColorRow role="accent" label="Accent color" onSet={setRoleColor} value={config.colors.accent} />
              <ColorRow role="tab" label="Active tab color" onSet={setRoleColor} value={config.colors.tab} />
            </div>

            {/* Live preview */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Live preview
              </p>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <span
                  className="rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: colors.primary,
                    color: readableForeground(colors.primary),
                  }}
                >
                  Primary
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: colors.tab,
                    color: readableForeground(colors.tab),
                  }}
                >
                  Active tab
                </span>
                <span className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full w-2/3 rounded-full"
                    style={{ backgroundColor: colors.accent }}
                  />
                </span>
              </div>
            </div>

            <Button type="button" variant="ghost" onClick={reset}>
              <RotateCcwIcon className="size-4" /> Reset to default
            </Button>

            {/* Advanced */}
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium"
              >
                Advanced customization
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform",
                    advanced && "rotate-180",
                  )}
                />
              </button>
              {advanced && (
                <div className="mt-3 space-y-4">
                  <ColorRow
                    role="secondary"
                    label="Secondary / links"
                    onSet={setRoleColor}
                    value={config.colors.secondary}
                  />

                  <SavedColors
                    saved={config.saved}
                    onAdd={addSaved}
                    onRemove={removeSaved}
                    onApply={(hex) => setRoleColor("primary", hex)}
                    current={config.colors.primary}
                  />

                  <Button type="button" variant="outline" onClick={shuffle}>
                    <ShuffleIcon className="size-4" /> Shuffle colors
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {!config.enabled && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckIcon className="size-3.5 text-success" />
            Using the default brand palette.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ColorRow({
  role,
  label,
  value,
  onSet,
}: {
  role: ThemeRole;
  label: string;
  value: string;
  onSet: (role: ThemeRole, hex: string) => void;
}) {
  // Show the live prop value when not editing; a local draft while typing —
  // so presets/shuffle stay reflected without a set-state-in-effect sync.
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = (v: string) => {
    if (isValidHex(v)) onSet(role, normalizeHex(v));
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onSet(role, e.target.value)}
        className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <Input
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft !== null) commit(draft);
        }}
        aria-label={`${label} hex`}
        className="w-28 font-mono"
      />
    </div>
  );
}

function SavedColors({
  saved,
  current,
  onAdd,
  onRemove,
  onApply,
}: {
  saved: string[];
  current: string;
  onAdd: (hex: string) => void;
  onRemove: (hex: string) => void;
  onApply: (hex: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Saved colors
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd(current)}
        >
          <PlusIcon className="size-4" /> Save current
        </Button>
      </div>
      {saved.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {saved.map((hex) => (
            <div key={hex} className="group relative">
              <button
                type="button"
                onClick={() => onApply(hex)}
                aria-label={`Apply ${hex}`}
                className="size-8 rounded-lg border border-border"
                style={{ backgroundColor: hex }}
              />
              <button
                type="button"
                onClick={() => onRemove(hex)}
                aria-label={`Remove ${hex}`}
                className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-foreground text-background"
              >
                <XIcon className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
