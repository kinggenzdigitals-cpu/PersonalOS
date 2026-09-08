"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fixed-length numeric code entry, rendered as one box per digit.
 *
 * Deliberately dependency-free. Handles the things people actually do with a
 * code from an email: type it, paste the whole thing, backspace through it, and
 * arrow between boxes. `value` is the plain digit string ("" up to `length`).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel = "Verification code",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the last digit lands, so the caller can auto-submit. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  const chars = React.useMemo(() => {
    const digits = value.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, i) => digits[i] ?? "");
  }, [value, length]);

  function focusBox(index: number) {
    const el = refs.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  }

  function commit(next: string[], caret: number) {
    const joined = next.join("").slice(0, length);
    onChange(joined);
    focusBox(caret);
    if (joined.length === length) onComplete?.(joined);
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const next = [...chars];
    let i = index;
    // Typing spills forward, so a code pasted into the first box still fills.
    for (const d of digits) {
      if (i >= length) break;
      next[i] = d;
      i++;
    }
    commit(next, i);
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...chars];
      if (next[index]) {
        next[index] = "";
        commit(next, index);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next, index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    focusBox(text.length);
    if (text.length === length) onComplete?.(text);
  }

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label={ariaLabel}
    >
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={char}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "tnum h-12 w-full min-w-0 rounded-xl border border-input bg-background text-center text-lg font-semibold shadow-soft transition-colors",
            "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}
