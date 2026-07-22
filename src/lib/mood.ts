export const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

export const MOOD_LABEL: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/** Warm scale from error (low) → success (high). */
export function moodColor(value: number | null | undefined): string {
  switch (value) {
    case 1:
      return "var(--error)";
    case 2:
      return "var(--warning)";
    case 3:
      return "var(--chart-3)";
    case 4:
      return "var(--sage)";
    case 5:
      return "var(--success)";
    default:
      return "var(--secondary)";
  }
}

export function moodEmoji(value: number | null | undefined): string {
  return value ? (MOOD_EMOJI[value] ?? "") : "";
}
