"use client";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";

/**
 * "loading" until the local attempts table has answered a query, so views never
 * flash "you have not attempted anything" at a returning student while
 * IndexedDB opens. "unavailable" when the browser blocks local storage.
 */
export function useAttemptsLoaded(): "loading" | "ready" | "unavailable" {
  const { ready, available } = useUserData();
  const loaded = useDbQuery(
    async (db) => {
      await db.attempts.limit(1).count();
      return true;
    },
    [],
    false,
  );
  if (ready && !available) return "unavailable";
  return loaded ? "ready" : "loading";
}
