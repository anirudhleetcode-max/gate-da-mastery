/**
 * Mock-test results analytics: scoring an attempt, subject/topic breakdowns,
 * weak topics, time analysis and factual exam-strategy diagnostics.
 *
 * Everything here is descriptive: what happened in this attempt and in the
 * student's own history. Nothing predicts a GATE score or rank.
 */
import type { Difficulty, QuestionType, SubjectId } from "@/lib/content/schema";
import type { QuestionPayload } from "@/lib/server/payload";
import type { AttemptRow, MockAttemptRow } from "@/lib/userdata/db";
import { groupScores, scoreTest, type GroupStat, type ScoreStatus, type TestScore } from "@/lib/scoring/score";
import { weakTopics } from "@/lib/analytics/stats";
import { timeUsedMs } from "./session";
import type { Confidence } from "./types";

/** One question of an attempt, scored, with everything the analytics need. */
export interface ScoredQuestion {
  id: string;
  /** 1-based position in the paper. */
  n: number;
  subjectId: SubjectId;
  topicId: string;
  topicName: string;
  type: QuestionType;
  /** Marks the question carries (1 or 2). */
  marks: number;
  difficulty: Difficulty;
  estimatedTimeSec: number;
  status: ScoreStatus;
  /** Marks awarded (negative for a penalised MCQ). */
  awarded: number;
  timeSpentMs: number;
  confidence?: Confidence;
  markedForReview: boolean;
  visited: boolean;
}

export interface ScoredAttempt {
  score: TestScore;
  items: ScoredQuestion[];
  bySubject: GroupStat[];
  byTopic: GroupStat[];
}

/** Score an attempt against the answer key (questions in paper order). */
export function scoreAttempt(questions: readonly QuestionPayload[], attempt: Pick<MockAttemptRow, "questions">, negativeMarking: boolean): ScoredAttempt {
  const responses = Object.fromEntries(questions.map((q) => [q.id, attempt.questions[q.id]?.response ?? null]));
  const score = scoreTest([...questions], responses, { negativeMarking });
  const items: ScoredQuestion[] = questions.map((q, i) => {
    const s = score.perQuestion[i];
    const st = attempt.questions[q.id];
    return {
      id: q.id,
      n: i + 1,
      subjectId: q.subjectId,
      topicId: q.topicId,
      topicName: q.topicName,
      type: q.type,
      marks: q.marks,
      difficulty: q.difficulty,
      estimatedTimeSec: q.estimatedTimeSec,
      status: s.status,
      awarded: s.marks,
      timeSpentMs: Math.max(0, st?.timeSpentMs ?? 0),
      confidence: st?.confidence,
      markedForReview: Boolean(st?.markedForReview),
      visited: Boolean(st?.visited),
    };
  });
  const qs = questions as unknown as Parameters<typeof groupScores>[0];
  return {
    score,
    items,
    bySubject: groupScores(qs, score.perQuestion, (q) => String(q.subjectId)),
    byTopic: groupScores(qs, score.perQuestion, (q) => String(q.topicId)),
  };
}

/** The summary stored on the attempt at submission (MockAttemptRow.result). */
export function resultSummary(score: TestScore, attempt: Pick<MockAttemptRow, "durationMs" | "remainingMs">): NonNullable<MockAttemptRow["result"]> {
  return {
    score: score.score,
    maxScore: score.maxScore,
    correct: score.correct,
    incorrect: score.incorrect,
    unanswered: score.unanswered,
    attempted: score.attempted,
    accuracy: score.accuracy,
    timeUsedMs: timeUsedMs(attempt),
  };
}

/** Average tracked time per attempted (correct or incorrect) question, or null. */
export function avgTimePerAttempted(items: readonly ScoredQuestion[]): number | null {
  const att = items.filter((i) => i.status === "correct" || i.status === "incorrect");
  if (!att.length) return null;
  return att.reduce((s, i) => s + i.timeSpentMs, 0) / att.length;
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ------------------------------------------------------------------ weak topics

export interface MockTopicStat {
  topicId: string;
  topicName: string;
  subjectId: SubjectId;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  /** correct / attempted, or null when nothing in the topic was attempted. */
  accuracy: number | null;
}

/** Per-topic results of this attempt. */
export function topicStats(items: readonly ScoredQuestion[]): MockTopicStat[] {
  const m = new Map<string, MockTopicStat>();
  for (const i of items) {
    if (i.status === "not_scored") continue;
    const t = m.get(i.topicId) ?? { topicId: i.topicId, topicName: i.topicName, subjectId: i.subjectId, total: 0, attempted: 0, correct: 0, incorrect: 0, accuracy: null };
    t.total++;
    if (i.status === "correct") t.correct++;
    if (i.status === "incorrect") t.incorrect++;
    m.set(i.topicId, t);
  }
  for (const t of m.values()) {
    t.attempted = t.correct + t.incorrect;
    t.accuracy = t.attempted ? t.correct / t.attempted : null;
  }
  return [...m.values()];
}

export const WEAK_TOPIC_THRESHOLD = 0.6;
export const WEAK_TOPIC_MIN_QUESTIONS = 2;

/**
 * Topics of this mock with at least `minQuestions` questions whose accuracy is
 * below `threshold` (or that were skipped entirely), weakest first.
 */
export function weakTopicsInMock(items: readonly ScoredQuestion[], opts: { minQuestions?: number; threshold?: number } = {}): MockTopicStat[] {
  const { minQuestions = WEAK_TOPIC_MIN_QUESTIONS, threshold = WEAK_TOPIC_THRESHOLD } = opts;
  return topicStats(items)
    .filter((t) => t.total >= minQuestions && (t.accuracy === null || t.accuracy < threshold))
    .sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1) || b.total - a.total);
}

export interface HistoryTopic {
  topicId: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

/**
 * Topics of this mock that the student keeps getting wrong across ALL their
 * attempts (PYQs, practice, revision and mocks): at least 3 scored attempts,
 * accuracy below 60% and at least 2 wrong answers.
 */
export function historicalWeakTopics(topicIds: ReadonlySet<string>, history: readonly Pick<AttemptRow, "topicId" | "status">[]): HistoryTopic[] {
  return weakTopics(history.filter((r) => topicIds.has(r.topicId)), { minAttempts: 3, threshold: WEAK_TOPIC_THRESHOLD, limit: 50 })
    .map((w) => ({ topicId: w.topicId, attempted: w.attempted, correct: w.correct, incorrect: w.attempted - w.correct, accuracy: w.accuracy }))
    .filter((w) => w.incorrect >= 2);
}

// ------------------------------------------------------------------ diagnostics

/** Time rules for "excessive time" (documented on the results page). */
export const SLOW_VS_ESTIMATE = 2;
export const SLOW_VS_MEDIAN = 1.5;
/** The median rule only applies above this time, so short questions are not flagged for a few seconds. */
export const SLOW_MEDIAN_FLOOR_MS = 60_000;
/** The median is only meaningful with at least this many answered questions. */
export const MEDIAN_MIN_QUESTIONS = 3;

export interface SlowQuestion {
  item: ScoredQuestion;
  overEstimate: boolean;
  overMedian: boolean;
}

export interface RepeatedQuestion {
  item: ScoredQuestion;
  /** Wrong answers to the same question before this attempt. */
  earlierWrong: number;
}

export interface RepeatedTopic {
  topicId: string;
  topicName: string;
  subjectId: SubjectId;
  wrongHere: number;
  wrongEarlier: number;
}

export interface Diagnostics {
  /** Median time over answered questions, or null with too few answers. */
  medianTimeMs: number | null;
  slow: SlowQuestion[];
  highConfidenceWrong: ScoredQuestion[];
  /** Skipped hard / very-hard questions (a reasonable choice under time pressure). */
  skippedHard: ScoredQuestion[];
  /** Skipped easy / moderate questions (possible missed marks). */
  skippedEasy: ScoredQuestion[];
  skippedEasyMarks: number;
  /** Wrong MCQs that cost marks through negative marking. */
  penalised: ScoredQuestion[];
  /** Total penalty (a positive number of marks lost). */
  totalPenalty: number;
  /** Marked for review but left unanswered at submission. */
  markedUnanswered: ScoredQuestion[];
  repeatedQuestions: RepeatedQuestion[];
  repeatedTopics: RepeatedTopic[];
}

type HistoryRow = Pick<AttemptRow, "questionId" | "topicId" | "status" | "createdAt" | "mockAttemptId">;

/**
 * Factual exam-strategy diagnostics for one attempt.
 *
 * @param items    scored questions of this attempt
 * @param history  the student's attempt history (all contexts)
 * @param opts.attemptId  this mock attempt's id (its own rows are excluded from "earlier")
 * @param opts.before     ISO time; only history rows strictly before it count as "earlier"
 */
export function computeDiagnostics(items: readonly ScoredQuestion[], history: readonly HistoryRow[], opts: { attemptId: string; before: string }): Diagnostics {
  const answeredTimes = items.filter((i) => (i.status === "correct" || i.status === "incorrect") && i.timeSpentMs > 0).map((i) => i.timeSpentMs);
  const medianTimeMs = answeredTimes.length >= MEDIAN_MIN_QUESTIONS ? median(answeredTimes) : null;

  const slow: SlowQuestion[] = [];
  for (const i of items) {
    if (i.timeSpentMs <= 0) continue;
    const overEstimate = i.estimatedTimeSec > 0 && i.timeSpentMs > SLOW_VS_ESTIMATE * i.estimatedTimeSec * 1000;
    const overMedian = medianTimeMs !== null && i.timeSpentMs >= SLOW_MEDIAN_FLOOR_MS && i.timeSpentMs > SLOW_VS_MEDIAN * medianTimeMs;
    if (overEstimate || overMedian) slow.push({ item: i, overEstimate, overMedian });
  }
  slow.sort((a, b) => b.item.timeSpentMs - a.item.timeSpentMs);

  const skipped = items.filter((i) => i.status === "unanswered");
  const skippedHard = skipped.filter((i) => i.difficulty === "HARD" || i.difficulty === "VERY_HARD");
  const skippedEasy = skipped.filter((i) => i.difficulty === "EASY" || i.difficulty === "MODERATE");
  const penalised = items.filter((i) => i.status === "incorrect" && i.awarded < 0);

  const earlier = history.filter((r) => r.mockAttemptId !== opts.attemptId && r.createdAt < opts.before);
  const earlierWrongByQuestion = new Map<string, number>();
  const earlierWrongByTopic = new Map<string, number>();
  for (const r of earlier) {
    if (r.status !== "incorrect") continue;
    earlierWrongByQuestion.set(r.questionId, (earlierWrongByQuestion.get(r.questionId) ?? 0) + 1);
    earlierWrongByTopic.set(r.topicId, (earlierWrongByTopic.get(r.topicId) ?? 0) + 1);
  }
  const wrong = items.filter((i) => i.status === "incorrect");
  const repeatedQuestions = wrong.filter((i) => earlierWrongByQuestion.has(i.id)).map((item) => ({ item, earlierWrong: earlierWrongByQuestion.get(item.id)! }));
  const topicMap = new Map<string, RepeatedTopic>();
  for (const i of wrong) {
    const e = earlierWrongByTopic.get(i.topicId);
    if (!e) continue;
    const t = topicMap.get(i.topicId) ?? { topicId: i.topicId, topicName: i.topicName, subjectId: i.subjectId, wrongHere: 0, wrongEarlier: e };
    t.wrongHere++;
    topicMap.set(i.topicId, t);
  }

  return {
    medianTimeMs,
    slow,
    highConfidenceWrong: wrong.filter((i) => i.confidence === "high"),
    skippedHard,
    skippedEasy,
    skippedEasyMarks: skippedEasy.reduce((s, i) => s + i.marks, 0),
    penalised,
    totalPenalty: Math.round(-penalised.reduce((s, i) => s + i.awarded, 0) * 100) / 100,
    markedUnanswered: skipped.filter((i) => i.markedForReview),
    repeatedQuestions,
    repeatedTopics: [...topicMap.values()].sort((a, b) => b.wrongHere + b.wrongEarlier - (a.wrongHere + a.wrongEarlier)),
  };
}

// ------------------------------------------------------------------ time

export interface SubjectTime {
  subjectId: SubjectId;
  totalMs: number;
  questions: number;
  avgMs: number;
  marks: number;
}

/** Tracked time per subject (all questions of the subject, answered or not). */
export function timePerSubject(items: readonly ScoredQuestion[]): SubjectTime[] {
  const m = new Map<SubjectId, SubjectTime>();
  for (const i of items) {
    const s = m.get(i.subjectId) ?? { subjectId: i.subjectId, totalMs: 0, questions: 0, avgMs: 0, marks: 0 };
    s.totalMs += i.timeSpentMs;
    s.questions++;
    s.marks += i.marks;
    m.set(i.subjectId, s);
  }
  for (const s of m.values()) s.avgMs = s.questions ? s.totalMs / s.questions : 0;
  return [...m.values()];
}

// ------------------------------------------------------------------ review filters

export type ReviewFilter = "all" | "correct" | "incorrect" | "skipped" | "marked";

export const REVIEW_FILTER_LABEL: Record<ReviewFilter, string> = {
  all: "All",
  correct: "Correct",
  incorrect: "Incorrect",
  skipped: "Skipped",
  marked: "Marked",
};

export function matchesReviewFilter(i: Pick<ScoredQuestion, "status" | "markedForReview">, f: ReviewFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "correct":
      return i.status === "correct";
    case "incorrect":
      return i.status === "incorrect";
    case "skipped":
      return i.status === "unanswered";
    case "marked":
      return i.markedForReview;
  }
}

export const STATUS_LABEL: Record<ScoreStatus, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Skipped",
  not_scored: "Not scored",
};
