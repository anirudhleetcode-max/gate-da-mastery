"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";
import { localDay } from "@/lib/userdata/db";

export type DataStatus = "loading" | "unavailable" | "ready";

/**
 * Whether the student's local data has loaded, so views can tell "nothing
 * recorded yet" apart from "still reading the database" and "storage blocked".
 */
export function useDataStatus(): DataStatus {
  const { ready, available } = useUserData();
  // Resolves to a number once the attempts table has been read (-1 until then).
  const count = useDbQuery((db) => db.attempts.count(), [], -1);
  if (!ready) return "loading";
  if (!available) return "unavailable";
  return count < 0 ? "loading" : "ready";
}

function subscribeMinute(cb: () => void) {
  const t = window.setInterval(cb, 60_000);
  return () => window.clearInterval(t);
}

/** Today's local date (YYYY-MM-DD) on the client; "" during server rendering. */
export function useToday(): string {
  return useSyncExternalStore(subscribeMinute, () => localDay(), () => "");
}

// ------------------------------------------------------------------ hash-synced tabs

const TAB_EVENT = "gate-da-tab";

function subscribeLocation(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  window.addEventListener(TAB_EVENT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener(TAB_EVENT, cb);
  };
}

function readTab(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      return decodeURIComponent(hash);
    } catch {
      return hash;
    }
  }
  return new URLSearchParams(window.location.search).get("tab") ?? "";
}

/**
 * The active tab, kept in the URL hash (`#pyqs`); `?tab=pyqs` is also accepted
 * for incoming links. The default tab has no hash. Server render and hydration
 * use the default tab; the linked tab is applied right after hydration.
 */
export function useHashTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: string) => void] {
  const raw = useSyncExternalStore(subscribeLocation, readTab, () => "");
  const tab = (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const setTab = useCallback(
    (next: string) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      url.hash = next === fallback ? "" : next;
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new Event(TAB_EVENT));
    },
    [fallback],
  );
  return [tab, setTab];
}
