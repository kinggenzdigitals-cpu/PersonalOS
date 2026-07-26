/**
 * Custom theme engine. When custom mode is ON, the user's four brand-role
 * colors are written as CSS variable overrides on <html>, on top of the default
 * brand palette in globals.css. Persisted to localStorage so it survives
 * refresh, logout, and login on the same device.
 */

export const THEME_STORAGE_KEY = "fht-theme";

export type ThemeRole = "primary" | "secondary" | "accent" | "tab";

export const ROLE_LABELS: Record<ThemeRole, string> = {
  primary: "Primary — sidebar, buttons, active nav",
  secondary: "Secondary — links, hovers, focus",
  accent: "Accent — progress, success",
  tab: "Tab — selected tab",
};

export type ThemeConfig = {
  enabled: boolean;
  colors: Record<ThemeRole, string>;
  saved: string[];
};

export const DEFAULT_COLORS: Record<ThemeRole, string> = {
  primary: "#012269",
  secondary: "#017dfe",
  accent: "#94d227",
  tab: "#017dfe",
};

export const DEFAULT_THEME: ThemeConfig = {
  enabled: false,
  colors: { ...DEFAULT_COLORS },
  saved: [],
};

export type ThemePreset = { name: string; colors: Record<ThemeRole, string> };

export const PRESETS: ThemePreset[] = [
  {
    name: "Ocean (brand)",
    colors: { primary: "#012269", secondary: "#017dfe", accent: "#94d227", tab: "#017dfe" },
  },
  {
    name: "Sunset",
    colors: { primary: "#7c2d12", secondary: "#ea580c", accent: "#f59e0b", tab: "#ea580c" },
  },
  {
    name: "Forest",
    colors: { primary: "#14532d", secondary: "#16a34a", accent: "#84cc16", tab: "#16a34a" },
  },
  {
    name: "Grape",
    colors: { primary: "#3b0764", secondary: "#9333ea", accent: "#ec4899", tab: "#9333ea" },
  },
  {
    name: "Midnight",
    colors: { primary: "#0f172a", secondary: "#3b82f6", accent: "#06b6d4", tab: "#3b82f6" },
  },
  {
    name: "Rose",
    colors: { primary: "#881337", secondary: "#e11d48", accent: "#f472b6", tab: "#e11d48" },
  },
];

export function isValidHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

export function normalizeHex(v: string): string {
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#([0-9a-f]{3})$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return s;
}

/** Relative luminance (0–1) of a hex color. */
export function luminance(hex: string): number {
  const c = normalizeHex(hex).slice(1);
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Readable text color (near-white or near-ink) for a given background. */
export function readableForeground(hex: string): string {
  return luminance(hex) > 0.42 ? "#0c1a33" : "#ffffff";
}

/** The CSS variable overrides for a set of role colors. */
export function themeVars(colors: Record<ThemeRole, string>): Record<string, string> {
  return {
    "--primary": colors.primary,
    "--primary-foreground": readableForeground(colors.primary),
    "--brand": colors.primary,
    "--brand-hover": colors.primary,
    "--sidebar-primary": colors.primary,
    "--sidebar-primary-foreground": readableForeground(colors.primary),
    "--ring": colors.secondary,
    "--sidebar-ring": colors.secondary,
    "--brand-2": colors.secondary,
    "--brand-2-hover": colors.secondary,
    "--accent-brand": colors.accent,
    "--tab-active": colors.tab,
    "--tab-active-foreground": readableForeground(colors.tab),
  };
}

const THEME_VAR_KEYS = Object.keys(themeVars(DEFAULT_COLORS));

/** Apply (or clear) the custom-theme overrides on the document root. */
export function applyTheme(config: ThemeConfig, root: HTMLElement): void {
  if (config.enabled) {
    const vars = themeVars(config.colors);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  } else {
    for (const k of THEME_VAR_KEYS) root.style.removeProperty(k);
  }
}

export function parseTheme(raw: string | null): ThemeConfig {
  if (!raw) return { ...DEFAULT_THEME, colors: { ...DEFAULT_COLORS } };
  try {
    const p = JSON.parse(raw) as Partial<ThemeConfig>;
    return {
      enabled: Boolean(p.enabled),
      colors: { ...DEFAULT_COLORS, ...(p.colors ?? {}) },
      saved: Array.isArray(p.saved) ? p.saved.slice(0, 24) : [],
    };
  } catch {
    return { ...DEFAULT_THEME, colors: { ...DEFAULT_COLORS } };
  }
}

/**
 * Shuffle the four role colors (plus saved colors) into readable new
 * combinations. Keeps the darkest color on primary/tab for text contrast.
 */
export function shuffleColors(config: ThemeConfig): Record<ThemeRole, string> {
  const pool = Array.from(
    new Set([...Object.values(config.colors), ...config.saved]),
  );
  // Need at least 2 distinct colors to shuffle meaningfully.
  if (pool.length < 2) return config.colors;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Prefer a dark-enough color for primary + tab so white text stays readable.
  const dark = shuffled.filter((c) => luminance(c) < 0.4);
  const primary = dark[0] ?? shuffled[0];
  const tab = dark[1] ?? dark[0] ?? shuffled[1] ?? shuffled[0];
  const rest = shuffled.filter((c) => c !== primary && c !== tab);
  return {
    primary,
    tab,
    secondary: rest[0] ?? shuffled[1] ?? primary,
    accent: rest[1] ?? rest[0] ?? shuffled[2] ?? tab,
  };
}
