"use client";

import * as React from "react";
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  DEFAULT_COLORS,
  parseTheme,
  applyTheme,
  shuffleColors,
  type ThemeConfig,
  type ThemeRole,
  type ThemePreset,
} from "@/lib/theme";

type Ctx = {
  config: ThemeConfig;
  setEnabled: (on: boolean) => void;
  setRoleColor: (role: ThemeRole, hex: string) => void;
  addSaved: (hex: string) => void;
  removeSaved: (hex: string) => void;
  applyPreset: (preset: ThemePreset) => void;
  shuffle: () => void;
  reset: () => void;
};

const ThemeCustomizerContext = React.createContext<Ctx | null>(null);

export function ThemeCustomizerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = React.useState<ThemeConfig>(() =>
    typeof window === "undefined"
      ? DEFAULT_THEME
      : parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY)),
  );

  // Apply + persist whenever the config changes (also runs once on mount,
  // matching the pre-paint script so there's no flash).
  React.useEffect(() => {
    applyTheme(config, document.documentElement);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage unavailable (private mode) — theme still applies for this session
    }
  }, [config]);

  const value = React.useMemo<Ctx>(
    () => ({
      config,
      setEnabled: (on) => setConfig((c) => ({ ...c, enabled: on })),
      setRoleColor: (role, hex) =>
        setConfig((c) => ({
          ...c,
          enabled: true,
          colors: { ...c.colors, [role]: hex },
        })),
      addSaved: (hex) =>
        setConfig((c) =>
          c.saved.includes(hex)
            ? c
            : { ...c, saved: [...c.saved, hex].slice(0, 24) },
        ),
      removeSaved: (hex) =>
        setConfig((c) => ({ ...c, saved: c.saved.filter((s) => s !== hex) })),
      applyPreset: (preset) =>
        setConfig((c) => ({ ...c, enabled: true, colors: { ...preset.colors } })),
      shuffle: () =>
        setConfig((c) => ({ ...c, enabled: true, colors: shuffleColors(c) })),
      reset: () =>
        setConfig((c) => ({
          enabled: false,
          colors: { ...DEFAULT_COLORS },
          saved: c.saved,
        })),
    }),
    [config],
  );

  return (
    <ThemeCustomizerContext.Provider value={value}>
      {children}
    </ThemeCustomizerContext.Provider>
  );
}

export function useThemeCustomizer(): Ctx {
  const ctx = React.useContext(ThemeCustomizerContext);
  if (!ctx) {
    throw new Error(
      "useThemeCustomizer must be used within a ThemeCustomizerProvider",
    );
  }
  return ctx;
}
