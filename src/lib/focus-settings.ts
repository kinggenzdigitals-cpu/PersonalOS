export type FocusTimerSettings = {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  sound: boolean;
  notify: boolean;
};

export const DEFAULT_FOCUS_SETTINGS: FocusTimerSettings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  sound: true,
  notify: false,
};

export function normalizeFocusSettings(value: unknown): FocusTimerSettings {
  const raw = typeof value === "object" && value !== null ? value as Partial<FocusTimerSettings> : {};
  const clamp = (n: unknown, fallback: number, max = 180) => {
    const parsed = Number(n);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, Math.round(parsed)));
  };
  return {
    focus: clamp(raw.focus, DEFAULT_FOCUS_SETTINGS.focus),
    short: clamp(raw.short, DEFAULT_FOCUS_SETTINGS.short),
    long: clamp(raw.long, DEFAULT_FOCUS_SETTINGS.long),
    longEvery: clamp(raw.longEvery, DEFAULT_FOCUS_SETTINGS.longEvery, 12),
    sound: typeof raw.sound === "boolean" ? raw.sound : DEFAULT_FOCUS_SETTINGS.sound,
    notify: typeof raw.notify === "boolean" ? raw.notify : DEFAULT_FOCUS_SETTINGS.notify,
  };
}