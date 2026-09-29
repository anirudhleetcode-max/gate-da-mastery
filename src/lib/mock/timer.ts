/**
 * Exam-timer rules: warning colour and screen-reader announcements.
 * Pure functions so the thresholds can be tested without a clock.
 */

/** Remaining-time thresholds (minutes) announced to screen readers. */
export const TIME_ALERT_MINUTES = [30, 10, 5, 1] as const;

/** The timer turns to the warning colour at 10 minutes remaining. */
export const TIME_WARNING_MS = 10 * 60_000;

export function isTimeWarning(remainingMs: number): boolean {
  return remainingMs <= TIME_WARNING_MS;
}

/**
 * The alert level for the remaining time: the smallest threshold (in minutes)
 * that the remaining time has reached, or null. Thresholds that are not
 * shorter than the whole test are skipped, so a 30-minute mock does not
 * "announce" 30 minutes at the start. Because the value only changes when a
 * threshold is crossed, rendering it in a polite live region announces each
 * threshold exactly once.
 */
export function timeAlertLevel(remainingMs: number, durationMs: number): number | null {
  let level: number | null = null;
  for (const m of TIME_ALERT_MINUTES) {
    const ms = m * 60_000;
    if (ms >= durationMs) continue;
    if (remainingMs <= ms) level = m;
  }
  return level;
}

export function timeAlertMessage(level: number | null): string {
  if (level === null) return "";
  if (level === 1) return "1 minute remaining. The test submits automatically at 0:00.";
  return `${level} minutes remaining.`;
}
