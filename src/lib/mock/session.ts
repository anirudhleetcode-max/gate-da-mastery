/**
 * Pure state transitions of a mock-test attempt while the exam is running.
 *
 * The exam UI keeps an {@link ExamState} in a reducer and persists
 * `state.attempt` (a {@link MockAttemptRow}) to IndexedDB about once a second,
 * so a refresh resumes exactly where the student left off. Nothing here
 * touches the database or the clock, which keeps it unit-testable.
 *
 * Behaviour, matching the GATE CBT interface where it matters:
 *  - Opening a question marks it visited (so an unanswered one turns "not answered").
 *  - "Save & next" keeps the response, removes a review mark and moves on.
 *  - "Mark for review & next" keeps the response, adds the review mark and moves on.
 *  - "Clear response" removes the response only (a review mark stays).
 *  - Plain navigation (palette, Previous, arrow keys) changes nothing but the position.
 *  - Unlike GATE, a selection is saved the moment it is made; the intro page says so.
 */
import type { MockAttemptRow, MockQuestionState } from "@/lib/userdata/db";
import type { UserResponse } from "@/lib/scoring/score";
import { isResponseEmpty } from "@/lib/scoring/score";
import type { Confidence } from "./types";

export interface ExamState {
  attempt: MockAttemptRow;
  /** Question ids in paper order. */
  order: string[];
}

export type ExamAction =
  | { type: "tick"; deltaMs: number; visible: boolean }
  | { type: "goto"; index: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "respond"; id: string; response: UserResponse | null }
  | { type: "confidence"; id: string; value: Confidence | undefined }
  | { type: "clear" }
  | { type: "saveAndNext" }
  | { type: "markAndNext" };

const emptyQuestion = (visited: boolean): MockQuestionState => ({ response: null, markedForReview: false, visited, timeSpentMs: 0 });

/**
 * A fresh in-progress attempt. The first question counts as visited because it
 * is on screen as soon as the exam starts.
 */
export function createAttempt(test: { id: string; durationMinutes: number }, questionIds: readonly string[], opts: { id: string; now: Date }): MockAttemptRow {
  const durationMs = test.durationMinutes * 60_000;
  return {
    id: opts.id,
    testId: test.id,
    status: "in_progress",
    startedAt: opts.now.toISOString(),
    durationMs,
    remainingMs: durationMs,
    currentIndex: 0,
    questions: Object.fromEntries(questionIds.map((id, i) => [id, emptyQuestion(i === 0)])),
  };
}

/**
 * Align a saved attempt with the current paper: add state for questions that
 * are missing, clamp the current index and make sure the current question is
 * marked visited. Saved answers are never dropped.
 */
export function reconcileAttempt(a: MockAttemptRow, questionIds: readonly string[]): MockAttemptRow {
  const questions = { ...a.questions };
  for (const id of questionIds) if (!questions[id]) questions[id] = emptyQuestion(false);
  const currentIndex = Math.max(0, Math.min(questionIds.length - 1, Number.isFinite(a.currentIndex) ? a.currentIndex : 0));
  const cur = questionIds[currentIndex];
  if (cur && !questions[cur].visited) questions[cur] = { ...questions[cur], visited: true };
  return { ...a, questions, currentIndex, remainingMs: Math.max(0, a.remainingMs) };
}

function patchQuestion(a: MockAttemptRow, id: string, patch: Partial<MockQuestionState>): MockAttemptRow {
  const prev = a.questions[id] ?? emptyQuestion(true);
  return { ...a, questions: { ...a.questions, [id]: { ...prev, ...patch } } };
}

function goto(state: ExamState, index: number): ExamState {
  const i = Math.max(0, Math.min(state.order.length - 1, index));
  const id = state.order[i];
  let attempt = state.attempt.currentIndex === i ? state.attempt : { ...state.attempt, currentIndex: i };
  if (id && !attempt.questions[id]?.visited) attempt = patchQuestion(attempt, id, { visited: true });
  return attempt === state.attempt ? state : { ...state, attempt };
}

/** The exam reducer. Returns the same object when nothing changes. */
export function examReducer(state: ExamState, action: ExamAction): ExamState {
  if (state.attempt.status !== "in_progress") return state;
  const a = state.attempt;
  const currentId = state.order[a.currentIndex];
  switch (action.type) {
    case "tick": {
      const delta = Math.max(0, action.deltaMs);
      if (delta === 0) return state;
      let attempt: MockAttemptRow = { ...a, remainingMs: Math.max(0, a.remainingMs - delta) };
      if (action.visible && currentId) {
        const q = attempt.questions[currentId];
        attempt = patchQuestion(attempt, currentId, { timeSpentMs: (q?.timeSpentMs ?? 0) + delta });
      }
      return { ...state, attempt };
    }
    case "goto":
      return goto(state, action.index);
    case "next":
      return goto(state, a.currentIndex + 1);
    case "previous":
      return goto(state, a.currentIndex - 1);
    case "respond": {
      const response = isResponseEmpty(action.response) ? null : action.response;
      return { ...state, attempt: patchQuestion(a, action.id, { response, visited: true }) };
    }
    case "confidence":
      return { ...state, attempt: patchQuestion(a, action.id, { confidence: action.value }) };
    case "clear":
      if (!currentId) return state;
      return { ...state, attempt: patchQuestion(a, currentId, { response: null, confidence: undefined }) };
    case "saveAndNext": {
      if (!currentId) return state;
      const next = { ...state, attempt: patchQuestion(a, currentId, { markedForReview: false }) };
      return goto(next, a.currentIndex + 1);
    }
    case "markAndNext": {
      if (!currentId) return state;
      const next = { ...state, attempt: patchQuestion(a, currentId, { markedForReview: true }) };
      return goto(next, a.currentIndex + 1);
    }
  }
}

/** The attempt as it is saved at submission (before scoring). */
export function submittedAttempt(a: MockAttemptRow, now: Date): MockAttemptRow {
  return { ...a, status: "submitted", submittedAt: a.submittedAt ?? now.toISOString(), remainingMs: Math.max(0, a.remainingMs) };
}

/** Time the student spent in the exam (duration minus remaining time). */
export function timeUsedMs(a: Pick<MockAttemptRow, "durationMs" | "remainingMs">): number {
  return Math.max(0, Math.min(a.durationMs, a.durationMs - Math.max(0, a.remainingMs)));
}

/** Indices of the first question of each section, in paper order. */
export function sectionStarts(sections: readonly ("GA" | "DA")[]): { section: "GA" | "DA"; start: number; end: number }[] {
  const out: { section: "GA" | "DA"; start: number; end: number }[] = [];
  sections.forEach((s, i) => {
    const last = out[out.length - 1];
    if (last && last.section === s) last.end = i;
    else out.push({ section: s, start: i, end: i });
  });
  return out;
}
