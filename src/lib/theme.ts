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
  primary: "#168cff",
  secondary: "#38b6ff",
  accent: "#63e875",
  tab: "#38b6ff",
};

export const DEFAULT_THEME: ThemeConfig = {
  enabled: false,
  colors: { ...DEFAULT_COLORS },
  saved: [],
};

export type ThemePreset = { name: string; colors: Record<ThemeRole, string> };

/**
 * Every preset color already clears 4.5:1 as text on the card, so
 * ensureReadableOn() leaves it alone and the swatches show exactly what gets
 * applied. The old 900-level primaries (#0f172a…) were near-invisible as text.
 */
export const PRESETS: ThemePreset[] = [
  {
    name: "Money (brand)",
    colors: { primary: "#168cff", secondary: "#38b6ff", accent: "#63e875", tab: "#38b6ff" },
  },
  {
    name: "Sunset",
    colors: { primary: "#fb923c", secondary: "#ea580c", accent: "#f59e0b", tab: "#ea580c" },
  },
  {
    name: "Forest",
    colors: { primary: "#4ade80", secondary: "#16a34a", accent: "#84cc16", tab: "#16a34a" },
  },
  {
    name: "Grape",
    colors: { primary: "#c084fc", secondary: "#a78bfa", accent: "#ec4899", tab: "#a78bfa" },
  },
  {
    name: "Midnight",
    colors: { primary: "#60a5fa", secondary: "#3b82f6", accent: "#06b6d4", tab: "#3b82f6" },
  },
  {
    name: "Rose",
    colors: { primary: "#fb7185", secondary: "#f43f5e", accent: "#f472b6", tab: "#f43f5e" },
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

/**
 * The surface brand-coloured TEXT sits on: `--card` in globals.css. Both
 * palettes there are dark, and `--background` is darker still, so a colour
 * that reads on the card reads on the page too.
 */
export const TEXT_SURFACE = "#071a31";

/** Dark ink for light brand fills — globals.css `--brand-foreground`. */
const INK = "#04122e";

/** WCAG contrast ratio (1–21) between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Readable text color (white or dark ink) for a given background: whichever
 * contrasts more. A fixed luminance cut-off (0.42) used to put white on
 * mid-tone fills such as the default #168cff at 3.4:1.
 */
export function readableForeground(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, INK)
    ? "#ffffff"
    : INK;
}

/**
 * The color lightened toward white just enough to read as text on the card
 * (WCAG AA, 4.5:1). Every role color is also a text color (text-brand,
 * text-tab-active…), so a dark pick like #0f172a rendered links and the active
 * nav item at ~1:1. Colors that already pass come back untouched.
 * Mirrored by THEME_INIT_SCRIPT in src/app/layout.tsx.
 */
export function ensureReadableOn(
  hex: string,
  bg: string = TEXT_SURFACE,
  min = 4.5,
): string {
  if (!(contrastRatio(hex, bg) < min)) return hex;
  const c = normalizeHex(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  for (let i = 1; i <= 20; i++) {
    const mixed =
      "#" +
      rgb
        .map((v) =>
          ("0" + Math.round(v + ((255 - v) * i) / 20).toString(16)).slice(-2),
        )
        .join("");
    if (contrastRatio(mixed, bg) >= min) return mixed;
  }
  return "#ffffff";
}

/** The CSS variable overrides for a set of role colors. */
export function themeVars(colors: Record<ThemeRole, string>): Record<string, string> {
  // Each role color doubles as a text color on the card, so it's made
  // readable there first; fills then take their ink from the adjusted value.
  const primary = ensureReadableOn(colors.primary);
  const secondary = ensureReadableOn(colors.secondary);
  const accent = ensureReadableOn(colors.accent);
  const tab = ensureReadableOn(colors.tab);
  return {
    "--primary": primary,
    "--primary-foreground": readableForeground(primary),
    "--brand": primary,
    "--brand-hover": primary,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": readableForeground(primary),
    // Every filled --brand surface reads its ink from this token. Without it
    // a dark custom primary kept the dark theme's navy foreground and turned
    // 27 buttons into navy-on-navy — the contrast fix had introduced a token
    // the palette engine never learned about.
    "--brand-foreground": readableForeground(primary),
    "--ring": secondary,
    "--sidebar-ring": secondary,
    "--brand-2": secondary,
    "--brand-2-hover": secondary,
    "--accent-brand": accent,
    "--tab-active": tab,
    "--tab-active-foreground": readableForeground(tab),
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
 * combinations. Puts colors that already read as text on the card on
 * primary/tab, the roles that carry the most text (links, the active nav).
 */
export function shuffleColors(config: ThemeConfig): Record<ThemeRole, string> {
  const pool = Array.from(
    new Set([...Object.values(config.colors), ...config.saved]),
  );
  // Need at least 2 distinct colors to shuffle meaningfully.
  if (pool.length < 2) return config.colors;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Prefer colors that already clear 4.5:1 on the card for primary + tab, so
  // themeVars() applies them as picked instead of lightening them.
  const readable = shuffled.filter(
    (c) => contrastRatio(c, TEXT_SURFACE) >= 4.5,
  );
  const primary = readable[0] ?? shuffled[0];
  const tab = readable[1] ?? readable[0] ?? shuffled[1] ?? shuffled[0];
  const rest = shuffled.filter((c) => c !== primary && c !== tab);
  return {
    primary,
    tab,
    secondary: rest[0] ?? shuffled[1] ?? primary,
    accent: rest[1] ?? rest[0] ?? shuffled[2] ?? tab,
  };
}
