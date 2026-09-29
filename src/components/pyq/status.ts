/**
 * The student's status on one PYQ, derived from their own attempts
 * (useQuestionStatuses). Nothing here is seeded or estimated.
 */
import type { QuestionStatus } from "@/lib/userdata/hooks";

export type PyqState = "unattempted" | "correct" | "incorrect" | "not_scored" | "skipped";

export function pyqState(s: QuestionStatus | undefined): PyqState {
  if (!s) return "unattempted";
  if (s.lastStatus === "correct" || s.lastStatus === "incorrect" || s.lastStatus === "not_scored") return s.lastStatus;
  // The latest attempt was skipped; an earlier correct answer still counts as solved.
  return s.correct > 0 ? "correct" : "skipped";
}

/** Attempted = an answer was submitted (correct, incorrect, or a marks-to-all question). */
export const isAttempted = (st: PyqState) => st === "correct" || st === "incorrect" || st === "not_scored";

export const STATE_LABEL: Record<PyqState, string> = {
  unattempted: "Not attempted",
  correct: "Solved correctly (latest attempt)",
  incorrect: "Answered incorrectly (latest attempt)",
  not_scored: "Attempted (marks to all, not scored)",
  skipped: "Skipped (no answer submitted)",
};
