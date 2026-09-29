"use client";
import { useCallback, useSyncExternalStore } from "react";

type Area = "local" | "session";
const EVENT = "gate-da-storage";

function area(a: Area): Storage | null {
  try {
    return a === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Read a Web Storage key as a live value (null on the server / when storage is blocked). */
export function useStorageValue(key: string, which: Area = "local"): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => area(which)?.getItem(key) ?? null,
    () => null,
  );
  const set = useCallback(
    (v: string | null) => {
      const s = area(which);
      if (!s) return;
      try {
        if (v === null) s.removeItem(key);
        else s.setItem(key, v);
      } catch {
        /* quota / blocked: ignore */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, which],
  );
  return [value, set];
}
