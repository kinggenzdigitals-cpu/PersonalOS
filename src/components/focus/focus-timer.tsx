"use client";

import * as React from "react";
import {
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SettingsIcon,
  BellIcon,
  Volume2Icon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { recordFocusSession } from "@/app/(app)/focus/actions";
import type { FocusLinkOptions, FocusSummary } from "@/lib/queries/focus";
import type { FocusSessionType } from "@/lib/supabase/types";

const STORAGE_KEY = "fht-focus";

type Settings = {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  sound: boolean;
  notify: boolean;
};

type Status = "idle" | "running" | "paused";

type State = {
  settings: Settings;
  phase: FocusSessionType;
  status: Status;
  endsAt: number | null;
  remainingMs: number;
  startedAt: number | null;
  focusCount: number;
  taskId: string | null;
  habitId: string | null;
};

const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  sound: true,
  notify: false,
};

const PHASE_LABEL: Record<FocusSessionType, string> = {
  focus: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

function phaseMinutes(phase: FocusSessionType, s: Settings): number {
  return phase === "focus" ? s.focus : phase === "short_break" ? s.short : s.long;
}

function phaseMs(phase: FocusSessionType, s: Settings): number {
  return Math.max(1, phaseMinutes(phase, s)) * 60_000;
}

function initialState(): State {
  const base: State = {
    settings: DEFAULT_SETTINGS,
    phase: "focus",
    status: "idle",
    endsAt: null,
    remainingMs: DEFAULT_SETTINGS.focus * 60_000,
    startedAt: null,
    focusCount: 0,
    taskId: null,
    habitId: null,
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<State>;
    const settings = { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) };
    const phase = p.phase ?? "focus";
    return {
      settings,
      phase,
      status: p.status ?? "idle",
      endsAt: p.endsAt ?? null,
      remainingMs: p.remainingMs ?? phaseMs(phase, settings),
      startedAt: p.startedAt ?? null,
      focusCount: p.focusCount ?? 0,
      taskId: p.taskId ?? null,
      habitId: p.habitId ?? null,
    };
  } catch {
    return base;
  }
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio unavailable */
  }
}

/** Mount gate so the localStorage-derived timer never mismatches SSR markup. */
export function FocusTimer(props: {
  options: FocusLinkOptions;
  summary: FocusSummary;
}) {
  const subscribe = React.useCallback(() => () => {}, []);
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) {
    return (
      <div className="space-y-5">
        <div className="h-96 animate-pulse rounded-2xl bg-secondary/50" />
      </div>
    );
  }
  return <FocusTimerInner {...props} />;
}

function FocusTimerInner({
  options,
  summary,
}: {
  options: FocusLinkOptions;
  summary: FocusSummary;
}) {
  const [state, setState] = React.useState<State>(initialState);
  const [showSettings, setShowSettings] = React.useState(false);
  const [today, setToday] = React.useState(summary);
  const [now, setNow] = React.useState(0);
  const stateRef = React.useRef(state);

  // Keep the ref in sync for the interval to read (outside render).
  React.useEffect(() => {
    stateRef.current = state;
  });

  // Persist on every change.
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const finish = React.useCallback((completed: boolean) => {
    const s = stateRef.current;
    const planned = phaseMinutes(s.phase, s.settings);
    const actualSeconds = completed
      ? Math.round(phaseMs(s.phase, s.settings) / 1000)
      : s.startedAt
        ? Math.max(0, Math.round((Date.now() - s.startedAt) / 1000))
        : 0;

    void recordFocusSession({
      sessionType: s.phase,
      taskId: s.taskId,
      habitId: s.habitId,
      plannedMinutes: planned,
      actualSeconds,
      completed,
      startedAt: new Date(s.startedAt ?? Date.now()).toISOString(),
    });

    const wasFocus = s.phase === "focus";
    if (completed && wasFocus) {
      setToday((t) => ({
        completedSessions: t.completedSessions + 1,
        focusedMinutes: t.focusedMinutes + Math.round(actualSeconds / 60),
        linkedSessions: t.linkedSessions + (s.taskId || s.habitId ? 1 : 0),
      }));
    }

    if (completed) {
      if (s.settings.sound) beep();
      if (s.settings.notify && typeof Notification !== "undefined") {
        try {
          if (Notification.permission === "granted") {
            new Notification(`${PHASE_LABEL[s.phase]} complete`, {
              body: wasFocus ? "Time for a break." : "Back to focus.",
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    let nextCount = s.focusCount;
    let nextPhase: FocusSessionType;
    if (wasFocus) {
      if (completed) nextCount += 1;
      const longNow =
        completed && nextCount > 0 && nextCount % s.settings.longEvery === 0;
      nextPhase = longNow ? "long_break" : "short_break";
    } else {
      nextPhase = "focus";
    }

    setState((prev) => ({
      ...prev,
      phase: nextPhase,
      focusCount: nextCount,
      status: "idle",
      endsAt: null,
      startedAt: null,
      remainingMs: phaseMs(nextPhase, prev.settings),
    }));
  }, []);

  // Timestamp-driven tick — accurate across tab changes + refresh.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const s = stateRef.current;
      if (s.status === "running" && s.endsAt != null && Date.now() >= s.endsAt) {
        finish(true);
      } else {
        setNow(Date.now());
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [finish]);

  const remainingMs =
    state.status === "running" && state.endsAt != null && now
      ? Math.max(0, state.endsAt - now)
      : state.remainingMs;
  const totalMs = phaseMs(state.phase, state.settings);
  const fraction = Math.min(1, Math.max(0, remainingMs / totalMs));
  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);
  const timeLabel = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  function start() {
    setState((s) => {
      const fresh = s.status === "idle";
      const ms = fresh ? phaseMs(s.phase, s.settings) : s.remainingMs;
      return {
        ...s,
        status: "running",
        endsAt: Date.now() + ms,
        remainingMs: ms,
        startedAt: fresh ? Date.now() : s.startedAt,
      };
    });
  }

  function pause() {
    setState((s) =>
      s.status !== "running" || s.endsAt == null
        ? s
        : {
            ...s,
            status: "paused",
            remainingMs: Math.max(0, s.endsAt - Date.now()),
            endsAt: null,
          },
    );
  }

  function reset() {
    setState((s) => ({
      ...s,
      status: "idle",
      endsAt: null,
      startedAt: null,
      remainingMs: phaseMs(s.phase, s.settings),
    }));
  }

  function updateSettings(patch: Partial<Settings>) {
    setState((s) => {
      const settings = { ...s.settings, ...patch };
      const remainingMs =
        s.status === "idle" ? phaseMs(s.phase, settings) : s.remainingMs;
      return { ...s, settings, remainingMs };
    });
  }

  async function toggleNotify(on: boolean) {
    if (on && typeof Notification !== "undefined") {
      try {
        const perm = await Notification.requestPermission();
        updateSettings({ notify: perm === "granted" });
        return;
      } catch {
        updateSettings({ notify: false });
        return;
      }
    }
    updateSettings({ notify: on });
  }

  const R = 52;
  const C = 2 * Math.PI * R;
  const ringColor =
    state.phase === "focus" ? "var(--brand)" : "var(--accent-brand)";

  return (
    <div className="space-y-5">
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center gap-5 pt-6">
          <div className="flex items-center gap-2">
            {(["focus", "short_break", "long_break"] as const).map((p) => (
              <span
                key={p}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  state.phase === p
                    ? "bg-tab-active text-tab-active-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {PHASE_LABEL[p]}
              </span>
            ))}
          </div>

          <div className="relative grid size-56 place-items-center">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="var(--secondary)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fraction)}
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="tnum font-display text-5xl">{timeLabel}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {PHASE_LABEL[state.phase]} ·{" "}
                {state.focusCount % state.settings.longEvery}/
                {state.settings.longEvery}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {state.status === "running" ? (
              <Button onClick={pause} className="min-w-28">
                <PauseIcon className="size-4" /> Pause
              </Button>
            ) : (
              <Button onClick={start} className="min-w-28">
                <PlayIcon className="size-4" />
                {state.status === "paused" ? "Resume" : "Start"}
              </Button>
            )}
            <Button variant="outline" onClick={reset} aria-label="Reset">
              <RotateCcwIcon className="size-4" /> Reset
            </Button>
            <Button
              variant="outline"
              onClick={() => finish(false)}
              aria-label="Skip session"
            >
              <SkipForwardIcon className="size-4" /> Skip
            </Button>
          </div>

          {(options.tasks.length > 0 || options.habits.length > 0) && (
            <div className="w-full max-w-xs">
              <label
                htmlFor="focus-link"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Working on (optional)
              </label>
              <select
                id="focus-link"
                value={
                  state.taskId
                    ? `task:${state.taskId}`
                    : state.habitId
                      ? `habit:${state.habitId}`
                      : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setState((s) => ({
                    ...s,
                    taskId: v.startsWith("task:") ? v.slice(5) : null,
                    habitId: v.startsWith("habit:") ? v.slice(6) : null,
                  }));
                }}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
              >
                <option value="">Nothing in particular</option>
                {options.tasks.length > 0 && (
                  <optgroup label="Tasks">
                    {options.tasks.map((t) => (
                      <option key={t.id} value={`task:${t.id}`}>
                        {t.title}
                      </option>
                    ))}
                  </optgroup>
                )}
                {options.habits.length > 0 && (
                  <optgroup label="Habits">
                    {options.habits.map((h) => (
                      <option key={h.id} value={`habit:${h.id}`}>
                        {h.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <SettingsIcon className="size-3.5" />
            {showSettings ? "Hide settings" : "Timer settings"}
          </button>

          {showSettings && (
            <div className="w-full space-y-4 border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField
                  label="Focus (min)"
                  value={state.settings.focus}
                  onChange={(v) => updateSettings({ focus: v })}
                />
                <NumberField
                  label="Short (min)"
                  value={state.settings.short}
                  onChange={(v) => updateSettings({ short: v })}
                />
                <NumberField
                  label="Long (min)"
                  value={state.settings.long}
                  onChange={(v) => updateSettings({ long: v })}
                />
                <NumberField
                  label="Long every"
                  value={state.settings.longEvery}
                  onChange={(v) => updateSettings({ longEvery: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Volume2Icon className="size-4 text-muted-foreground" /> Sound
                </span>
                <Switch
                  checked={state.settings.sound}
                  onCheckedChange={(v) => updateSettings({ sound: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <BellIcon className="size-4 text-muted-foreground" /> Browser
                  notification
                </span>
                <Switch
                  checked={state.settings.notify}
                  onCheckedChange={toggleNotify}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="grid grid-cols-3 gap-2 pt-6 text-center">
          <Stat label="Sessions" value={`${today.completedSessions}`} />
          <Stat label="Focused min" value={`${today.focusedMinutes}`} />
          <Stat label="Linked" value={`${today.linkedSessions}`} />
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input
        type="number"
        min={1}
        max={180}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n) && n > 0) onChange(Math.min(180, n));
        }}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 py-3">
      <p className="tnum font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
