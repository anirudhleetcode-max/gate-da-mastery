/**
 * Simple spaced-revision scheduler (a small variant of SM-2 tuned for a
 * months-long exam preparation horizon).
 *
 *  Forgot  → review again tomorrow, ease −0.20, lapse counted
 *  Almost  → short interval (×1.2, minimum 2 days on first review), ease −0.05
 *  Got it  → 3 days, then 7 days, then interval × ease; ease +0.05
 *
 * Intervals are capped at MAX_INTERVAL_DAYS so nothing disappears for longer
 * than a revision cycle before the exam.
 */

export type RecallGrade = "forgot" | "almost" | "got_it";

export interface RevisionState {
  intervalDays: number;
  ease: number;
  reviewCount: number;
  lapses: number;
  lastReviewed: string | null; // ISO date-time
  nextReview: string; // ISO date (YYYY-MM-DD)
  confidence: RecallGrade | null;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const START_EASE = 2.3;
export const MAX_INTERVAL_DAYS = 60;

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** A new item is due immediately (today). */
export function initialState(now: Date): RevisionState {
  return {
    intervalDays: 0,
    ease: START_EASE,
    reviewCount: 0,
    lapses: 0,
    lastReviewed: null,
    nextReview: toIsoDate(now),
    confidence: null,
  };
}

export function review(state: RevisionState, grade: RecallGrade, now: Date): RevisionState {
  let { intervalDays, ease, lapses } = state;
  const reviewCount = state.reviewCount + 1;
  if (grade === "forgot") {
    intervalDays = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses += 1;
  } else if (grade === "almost") {
    intervalDays = state.reviewCount === 0 ? 2 : Math.max(2, Math.round(Math.max(1, intervalDays) * 1.2));
    ease = Math.max(MIN_EASE, ease - 0.05);
  } else {
    if (state.reviewCount === 0 || intervalDays === 0) intervalDays = 3;
    else if (intervalDays < 7) intervalDays = 7;
    else intervalDays = Math.round(intervalDays * ease);
    ease = Math.min(MAX_EASE, ease + 0.05);
  }
  intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays);
  return {
    intervalDays,
    ease: Math.round(ease * 100) / 100,
    reviewCount,
    lapses,
    lastReviewed: now.toISOString(),
    nextReview: toIsoDate(addDays(now, intervalDays)),
    confidence: grade,
  };
}

export function isDue(state: Pick<RevisionState, "nextReview">, now: Date): boolean {
  return state.nextReview <= toIsoDate(now);
}

export function daysOverdue(state: Pick<RevisionState, "nextReview">, now: Date): number {
  const due = new Date(`${state.nextReview}T00:00:00`);
  const today = new Date(`${toIsoDate(now)}T00:00:00`);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86_400_000));
}

/** "Frequently forgotten": at least two lapses, or last grade was "forgot" after 2+ reviews. */
export function isFrequentlyForgotten(state: Pick<RevisionState, "lapses" | "reviewCount" | "confidence">): boolean {
  return state.lapses >= 2 || (state.reviewCount >= 2 && state.confidence === "forgot");
}
