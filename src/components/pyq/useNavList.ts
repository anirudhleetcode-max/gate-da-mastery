"use client";
import { useCallback } from "react";
import { useStorageValue } from "@/lib/useStorage";
// Type-only import: it ties this key to the question page's constant at compile time
// (tsc fails if they ever differ) without bundling QuestionView and KaTeX into list pages.
import type { NAV_LIST_KEY as QuestionPageNavListKey } from "@/app/(app)/questions/[id]/QuestionPageClient";

export const NAV_LIST_KEY: typeof QuestionPageNavListKey = "gate-da-nav-list";

/**
 * Returns a function that stores the ordered id list the student is browsing,
 * so the question page can offer Previous / Next within it.
 */
export function useStoreNavList() {
  const [, set] = useStorageValue(NAV_LIST_KEY, "session");
  return useCallback((ids: string[]) => set(JSON.stringify(ids)), [set]);
}

const ANCHOR_STATE_KEY = "gateDaListAnchor";

/**
 * Remember which question the student opened from a list, in the list's own
 * history entry, so Back can bring that row into view again (the virtual list
 * is rebuilt on return, which defeats the browser's scroll restoration).
 * The spread keeps Next.js' router state and bypasses its history patch.
 */
export function rememberListAnchor(id: string) {
  try {
    const st: unknown = window.history.state;
    if (st && typeof st === "object") window.history.replaceState({ ...st, [ANCHOR_STATE_KEY]: id }, "");
  } catch {
    /* history unavailable: nothing to restore later */
  }
}

/** Reads and clears the anchor stored by `rememberListAnchor` for this history entry. */
export function takeListAnchor(): string | null {
  try {
    const st: unknown = window.history.state;
    if (!st || typeof st !== "object") return null;
    const rec = st as Record<string, unknown>;
    const id = rec[ANCHOR_STATE_KEY];
    if (typeof id !== "string") return null;
    const rest = { ...rec };
    delete rest[ANCHOR_STATE_KEY];
    window.history.replaceState(rest, "");
    return id;
  } catch {
    return null;
  }
}
