/**
 * Global "Hide sensitive info" store. One source of truth for masking financial
 * amounts everywhere, read via useSyncExternalStore so it stays correct through
 * SSR/hydration and updates instantly on toggle. Persisted to localStorage.
 * Only display is masked — stored data and calculations are untouched.
 */

const KEY = "fht-privacy";

let hidden = false;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    hidden = window.localStorage.getItem(KEY) === "1";
  } catch {
    hidden = false;
  }
  document.documentElement.dataset.privacy = hidden ? "hidden" : "";
}

export function getHidden(): boolean {
  ensureInit();
  return hidden;
}

/** Server snapshot — always visible; the pre-paint script masks if needed. */
export function getServerHidden(): boolean {
  return false;
}

export function setHidden(next: boolean): void {
  ensureInit();
  hidden = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.privacy = next ? "hidden" : "";
  listeners.forEach((l) => l());
}

export function toggleHidden(): void {
  setHidden(!getHidden());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
