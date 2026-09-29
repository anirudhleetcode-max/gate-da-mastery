/**
 * GATE-style question-palette states.
 *
 * The official GATE CBT palette distinguishes five states. This module derives
 * the state of one question from its saved exam state, so the palette, the
 * legend, the submit summary and the intro-page instructions all agree.
 */
import type { MockQuestionState } from "@/lib/userdata/db";
import { isResponseEmpty } from "@/lib/scoring/score";

export type PaletteState = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

/** Legend order, as in the GATE interface. */
export const PALETTE_ORDER: PaletteState[] = ["not_visited", "not_answered", "answered", "marked", "answered_marked"];

export const PALETTE_LABEL: Record<PaletteState, string> = {
  not_visited: "Not visited",
  not_answered: "Not answered",
  answered: "Answered",
  marked: "Marked for review",
  answered_marked: "Answered & marked for review",
};

/** Longer explanations used in the instructions. */
export const PALETTE_HELP: Record<PaletteState, string> = {
  not_visited: "You have not opened this question yet.",
  not_answered: "You opened the question but have not given an answer.",
  answered: "You have answered the question.",
  marked: "You marked the question for review without answering it. It is not scored unless you answer it.",
  answered_marked: "You answered and also marked the question for review. The answer IS scored, exactly as in GATE.",
};

/** True when the question has a non-empty response. */
export function hasAnswer(q: MockQuestionState | undefined): boolean {
  return Boolean(q) && !isResponseEmpty(q!.response);
}

/**
 * Palette state of one question.
 *  - never opened                  → not_visited
 *  - answered + marked for review  → answered_marked
 *  - answered                      → answered
 *  - marked (no answer)            → marked
 *  - opened, no answer, not marked → not_answered
 */
export function paletteState(q: MockQuestionState | undefined): PaletteState {
  if (!q) return "not_visited";
  const answered = hasAnswer(q);
  if (answered && q.markedForReview) return "answered_marked";
  if (answered) return "answered";
  if (q.markedForReview) return "marked";
  return q.visited ? "not_answered" : "not_visited";
}

export type PaletteCounts = Record<PaletteState, number>;

/** Number of questions in each palette state, for the given question ids. */
export function paletteCounts(ids: readonly string[], questions: Record<string, MockQuestionState>): PaletteCounts {
  const out: PaletteCounts = { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 };
  for (const id of ids) out[paletteState(questions[id])]++;
  return out;
}

/** Answered questions (including answered & marked), i.e. the ones that will be scored. */
export function answeredCount(c: PaletteCounts): number {
  return c.answered + c.answered_marked;
}

/** Accessible name of a palette button, e.g. "Question 7, answered & marked for review, current question". */
export function paletteAriaLabel(n: number, state: PaletteState, current: boolean): string {
  return `Question ${n}, ${PALETTE_LABEL[state].toLowerCase()}${current ? ", current question" : ""}`;
}
