/**
 * The compact question metadata that Practice Now and Today's GATE DA work
 * from, plus the student's per-question history derived from their attempts.
 * Pure and isomorphic: server pages call `toPoolQuestion`, client components
 * call `questionHistory`.
 */
import type { Difficulty, QuestionOrigin, QuestionType, SubjectId } from "@/lib/content/schema";
import type { QuestionMeta } from "@/lib/content/types";
import type { AttemptRow } from "@/lib/userdata/db";

/** Selection metadata only: no stem, options, answers or solutions. */
export interface PoolQuestion {
  id: string;
  origin: QuestionOrigin;
  subjectId: SubjectId;
  topicId: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  estimatedTimeSec: number;
  year?: number;
  questionNumber?: number;
  section?: "GA" | "DA";
  /** Mock questions only: the mock they belong to (eligible once that mock is submitted). */
  testId?: string;
}

export function toPoolQuestion(m: QuestionMeta): PoolQuestion {
  const q: PoolQuestion = {
    id: m.id,
    origin: m.origin,
    subjectId: m.subjectId,
    topicId: m.topicId,
    type: m.type,
    marks: m.marks,
    difficulty: m.difficulty,
    estimatedTimeSec: m.estimatedTimeSec,
  };
  if (m.year !== undefined) q.year = m.year;
  if (m.questionNumber !== undefined) q.questionNumber = m.questionNumber;
  if (m.section !== undefined) q.section = m.section;
  if (m.testId !== undefined) q.testId = m.testId;
  return q;
}

/** Short label for a question in lists, e.g. "GATE DA 2025 · Q.23", "Mock 4 · Q.7", "Original practice". */
export function poolQuestionLabel(q: Pick<PoolQuestion, "origin" | "year" | "questionNumber" | "testId">): string {
  if (q.origin === "OFFICIAL_PYQ") return `GATE DA ${q.year} · Q.${q.questionNumber}`;
  if (q.origin === "MOCK_TEST") return `Mock ${Number(q.testId?.replace(/^mock-/, "") ?? 0)} · Q.${q.questionNumber ?? "?"}`;
  return "Original practice";
}

export interface QuestionHistory {
  /** Number of submitted answers (correct, incorrect or marks-to-all). */
  answered: number;
  correct: number;
  incorrect: number;
  /** Status of the latest correct/incorrect attempt, or null if none. */
  lastScored: "correct" | "incorrect" | null;
  lastAt: string;
}

/**
 * Per-question history. A skipped (unanswered) mock question does not count
 * as answered, so it still shows up as "unattempted" in practice.
 */
export function questionHistory(attempts: readonly Pick<AttemptRow, "questionId" | "status" | "createdAt">[]): Map<string, QuestionHistory> {
  const m = new Map<string, QuestionHistory & { lastScoredAt: string }>();
  for (const a of attempts) {
    let h = m.get(a.questionId);
    if (!h) {
      h = { answered: 0, correct: 0, incorrect: 0, lastScored: null, lastAt: a.createdAt, lastScoredAt: "" };
      m.set(a.questionId, h);
    }
    if (a.createdAt > h.lastAt) h.lastAt = a.createdAt;
    if (a.status === "unanswered") continue;
    h.answered++;
    if (a.status === "correct" || a.status === "incorrect") {
      if (a.status === "correct") h.correct++;
      else h.incorrect++;
      if (a.createdAt >= h.lastScoredAt) {
        h.lastScoredAt = a.createdAt;
        h.lastScored = a.status;
      }
    }
  }
  return m;
}

/** "unattempted" | "incorrect" (latest scored attempt wrong) | "correct" | "other" (e.g. marks-to-all only). */
export function historyState(h: QuestionHistory | undefined): "unattempted" | "incorrect" | "correct" | "other" {
  if (!h || h.answered === 0) return "unattempted";
  if (h.lastScored === "incorrect") return "incorrect";
  if (h.lastScored === "correct") return "correct";
  return "other";
}
