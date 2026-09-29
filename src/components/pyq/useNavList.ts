"use client";
import { useCallback } from "react";
import { useStorageValue } from "@/lib/useStorage";
import { NAV_LIST_KEY } from "@/app/(app)/questions/[id]/QuestionPageClient";

/**
 * Returns a function that stores the ordered id list the student is browsing,
 * so the question page can offer Previous / Next within it.
 */
export function useStoreNavList() {
  const [, set] = useStorageValue(NAV_LIST_KEY, "session");
  return useCallback((ids: string[]) => set(JSON.stringify(ids)), [set]);
}
