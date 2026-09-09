"use client";

import * as React from "react";

/**
 * Collapsed/expanded state of the desktop sidebar.
 *
 * Deliberately the same shape as privacy-store.ts: a tiny external store read
 * through useSyncExternalStore, persisted to localStorage, and mirrored onto a
 * `data-sidebar` attribute on <html>. The attribute — not React — is what the
 * CSS reads for the rail width and the content offset, and a pre-paint script
 * in the root layout stamps it from localStorage before first paint. That is
 * what stops a collapsed sidebar from painting at full width and snapping
 * shut a beat later.
 *
 * The server snapshot is always "expanded": the server cannot know the stored
 * preference, and choosing the more common state keeps hydration honest.
 */
const KEY = "fht-sidebar";
const COLLAPSED = "1";

const listeners = new Set<() => void>();
let collapsed: boolean | null = null;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === COLLAPSED;
  } catch {
    // Storage blocked (private mode, site-data settings): fall back to open.
    return false;
  }
}

function current(): boolean {
  if (collapsed === null) collapsed = read();
  return collapsed;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCollapsed(): boolean {
  return current();
}

export function getServerCollapsed(): boolean {
  return false;
}

export function setCollapsed(next: boolean): void {
  collapsed = next;
  try {
    window.localStorage.setItem(KEY, next ? COLLAPSED : "0");
  } catch {
    // Not persisted, but still applied for this session.
  }
  try {
    // An empty value leaves the attribute present but unmatched by the
    // `[data-sidebar="collapsed"]` selector, which is what we want.
    document.documentElement.dataset.sidebar = next ? "collapsed" : "";
  } catch {
    // No document (should not happen in a client store); nothing to stamp.
  }
  listeners.forEach((l) => l());
}

export function toggleCollapsed(): void {
  setCollapsed(!current());
}

/** Reactive collapsed flag for components. */
export function useSidebarCollapsed(): boolean {
  return React.useSyncExternalStore(subscribe, getCollapsed, getServerCollapsed);
}
