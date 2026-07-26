"use client";

import * as React from "react";
import {
  ShuffleIcon,
  RotateCcwIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/nav/theme-toggle";
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

const ROLES: { id: ThemeRole; label: string }[] = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "accent", label: "Accent" },
  { id: "tab", label: "Tab" },
];

export function ThemeSettings() {
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
  const [activeRole, setActiveRole] = React.useState<ThemeRole>("primary");
  const [hexInput, setHexInput] = React.useState("");

  const colors = config.enabled ? config.colors : DEFAULT_COLORS;
  const current = config.colors[activeRole];

  function commitHex(value: string, alsoSave: boolean) {
    if (!isValidHex(value)) return;
    const hex = normalizeHex(value);
    setRoleColor(activeRole, hex);
    if (alsoSave) addSaved(hex);
    setHexInput("");
  }

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-5 pt-6">
        {/* Light / dark */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark.
            </p>
          </div>
          <ThemeToggle className="border border-border" />
        </div>

        <div className="border-t border-border" />

        {/* Custom theme toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Custom theme</p>
            <p className="text-xs text-muted-foreground">
              Personalize your brand colors.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable custom theme"
          />
        </div>

        {config.enabled && (
          <div className="space-y-5">
            {/* Presets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Preset palettes
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
                      {(["primary", "secondary", "accent", "tab"] as const).map(
                        (r) => (
                          <span
                            key={r}
                            className="size-4 rounded-full border border-card"
                            style={{ backgroundColor: preset.colors[r] }}
                          />
                        ),
                      )}
                    </span>
                    <span className="truncate text-xs font-medium">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Choose a role to edit
              </p>
              <div className="grid grid-cols-4 gap-1 rounded-full bg-secondary p-1">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRole(role.id)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors",
                      activeRole === role.id
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground",
                    )}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: config.colors[role.id] }}
                    />
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker + hex input */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Pick ${activeRole} color`}
                value={current}
                onChange={(e) => setRoleColor(activeRole, e.target.value)}
                className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              <Input
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitHex(hexInput, false);
                }}
                placeholder={current}
                aria-label="Hex color"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Add to saved colors"
                onClick={() =>
                  commitHex(isValidHex(hexInput) ? hexInput : current, true)
                }
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>

            {/* Saved colors */}
            {config.saved.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Saved colors — tap to apply to {activeRole}
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.saved.map((hex) => (
                    <div key={hex} className="group relative">
                      <button
                        type="button"
                        onClick={() => setRoleColor(activeRole, hex)}
                        aria-label={`Apply ${hex}`}
                        className="size-8 rounded-lg border border-border"
                        style={{ backgroundColor: hex }}
                      />
                      <button
                        type="button"
                        onClick={() => removeSaved(hex)}
                        aria-label={`Remove ${hex}`}
                        className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-foreground text-background"
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  className="text-sm font-medium underline"
                  style={{ color: colors.secondary }}
                >
                  A link
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

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={shuffle}>
                <ShuffleIcon className="size-4" /> Shuffle colors
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                <RotateCcwIcon className="size-4" /> Reset to default
              </Button>
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
