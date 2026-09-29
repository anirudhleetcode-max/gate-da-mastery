"use client";
/**
 * Loading state and "today" for the dashboard, progress, today and practice
 * pages.
 *
 * The live hooks return empty arrays until IndexedDB answers, which would
 * briefly show a returning student the first-run onboarding. A cheap live
 * count of each table tells "still loading" apart from "really empty".
 */
import { useSyncExternalStore } from "react";
import { localDay } from "@/lib/userdata/db";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";

export interface TableCounts {
  attempts: number;
  mockAttempts: number;
  revisionItems: number;
}

export type LoadStatus = "loading" | "unavailable" | "ready";

/**
 * "loading" until the local database has answered AND every array passed in
 * has caught up with its table's count; "unavailable" when IndexedDB is
 * blocked (private window / storage disabled).
 */
export function useLoadStatus(loaded: Partial<Record<keyof TableCounts, readonly unknown[]>> = {}): { status: LoadStatus; counts: TableCounts | null } {
  const { ready, available } = useUserData();
  const counts = useDbQuery<TableCounts | null>(
    async (db) => ({ attempts: await db.attempts.count(), mockAttempts: await db.mockAttempts.count(), revisionItems: await db.revisionItems.count() }),
    [],
    null,
  );
  if (ready && !available) return { status: "unavailable", counts: { attempts: 0, mockAttempts: 0, revisionItems: 0 } };
  if (!ready || counts === null) return { status: "loading", counts };
  for (const k of Object.keys(loaded) as (keyof TableCounts)[]) {
    if (counts[k] > 0 && (loaded[k]?.length ?? 0) === 0) return { status: "loading", counts };
  }
  return { status: "ready", counts };
}

function subscribeDay(cb: () => void) {
  const t = window.setInterval(cb, 60_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.clearInterval(t);
    document.removeEventListener("visibilitychange", cb);
  };
}

/** The local date "YYYY-MM-DD" (null during server rendering); rolls over at midnight. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribeDay, () => localDay(), () => null);
}

/** Noon of a local "YYYY-MM-DD" as a Date (stable "now" for day-level computations). */
export function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

/** "YYYY-MM-DD" n days before/after a local day. */
export function shiftDay(day: string, n: number): string {
  const d = dayToDate(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-12" → "12 Sep". */
export function shortDate(day: string): string {
  const [, m, d] = day.slice(0, 10).split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : day;
}

/** Relative due label for a revision item. */
export function dueLabel(nextReview: string, today: string): { text: string; tone: "danger" | "warning" | "neutral" } {
  if (nextReview < today) {
    const days = Math.round((dayToDate(today).getTime() - dayToDate(nextReview).getTime()) / 86_400_000);
    return { text: `Overdue ${days} ${days === 1 ? "day" : "days"}`, tone: "danger" };
  }
  if (nextReview === today) return { text: "Due today", tone: "warning" };
  if (nextReview === shiftDay(today, 1)) return { text: "Due tomorrow", tone: "neutral" };
  return { text: `Due ${shortDate(nextReview)}`, tone: "neutral" };
}
