"use client";
/**
 * A Web Storage value as a live external store that keeps working when storage
 * is blocked (private windows, disabled site data): the value then lives in
 * memory for this page session instead of silently dropping every update.
 *
 * Unlike useStorageValue (src/lib/useStorage.ts), writes always land in the
 * in-memory copy first, so controlled inputs and the exam timer never lose a
 * change. Values from storage are untrusted strings; callers parse them.
 */
import { useCallback, useSyncExternalStore } from "react";

type Area = "local" | "session";

const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function storage(area: Area): Storage | null {
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(area: Area, key: string): string | null {
  const k = `${area}:${key}`;
  if (memory.has(k)) return memory.get(k) ?? null;
  let v: string | null = null;
  try {
    v = storage(area)?.getItem(key) ?? null;
  } catch {
    v = null;
  }
  memory.set(k, v);
  return v;
}

export function writePersistent(area: Area, key: string, value: string | null) {
  memory.set(`${area}:${key}`, value);
  const s = storage(area);
  try {
    if (s) {
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
    }
  } catch {
    /* quota exceeded / blocked: the in-memory copy still holds the value */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Another tab changed local storage: drop the cached copy so the next read sees it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null) memory.clear();
    else memory.delete(`local:${e.key}`);
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** [value, set] for a Web Storage key; null during server rendering and before anything is saved. */
export function usePersistentValue(area: Area, key: string): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(area, key),
    () => null,
  );
  const set = useCallback((v: string | null) => writePersistent(area, key, v), [area, key]);
  return [value, set];
}
