/**
 * GATE-style scoring.
 *
 *  - MCQ: +marks if correct; −marks/3 if wrong (when negative marking is on);
 *    0 if unanswered.
 *  - MSQ: +marks only if the selected set equals the correct set exactly; no
 *    partial credit and no negative marking.
 *  - NAT: +marks if the value lies in the official/verified range [min, max]
 *    (inclusive); no negative marking.
 *  - MTA ("marks to all" in an official key): excluded from scoring in
 *    practice (policy "exclude"), or awarded to everyone (policy "award").
 */
import type { Answer, OptionLabel, QuestionType } from "@/lib/content/schema";

export type UserResponse =
  | { kind: "MCQ"; choice: OptionLabel }
  | { kind: "MSQ"; choices: OptionLabel[] }
  | { kind: "NAT"; value: string };

export type ScoreStatus = "correct" | "incorrect" | "unanswered" | "not_scored";

export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  answer: Answer;
}

export interface QuestionScore {
  questionId: string;
  status: ScoreStatus;
  /** Marks awarded (negative for a penalised MCQ). */
  marks: number;
  maxMarks: number;
}

export interface ScoreOptions {
  negativeMarking: boolean;
  mtaPolicy?: "exclude" | "award";
}

/** Penalty for a wrong MCQ: one third of the question's marks. */
export function mcqPenalty(marks: number): number {
  return marks / 3;
}

/** Parse a NAT entry. Accepts optional sign, decimals and leading "."; rejects anything else. */
export function parseNat(value: string): number | null {
  const s = value.trim();
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isResponseEmpty(r: UserResponse | null | undefined): boolean {
  if (!r) return true;
  if (r.kind === "MSQ") return r.choices.length === 0;
  if (r.kind === "NAT") return r.value.trim() === "";
  return false;
}

export function isCorrect(answer: Answer, r: UserResponse): boolean {
  switch (answer.kind) {
    case "MCQ":
      return r.kind === "MCQ" && r.choice === answer.correct;
    case "MSQ": {
      if (r.kind !== "MSQ") return false;
      const a = [...new Set(answer.correct)].sort().join(",");
      const b = [...new Set(r.choices)].sort().join(",");
      return a === b;
    }
    case "NAT": {
      if (r.kind !== "NAT") return false;
      const v = parseNat(r.value);
      if (v === null) return false;
      const eps = 1e-9 * Math.max(1, Math.abs(answer.min), Math.abs(answer.max));
      return v >= answer.min - eps && v <= answer.max + eps;
    }
    case "MTA":
      return true;
  }
}

export function scoreQuestion(
  q: ScorableQuestion,
  response: UserResponse | null | undefined,
  opts: ScoreOptions,
): QuestionScore {
  const base = { questionId: q.id, maxMarks: q.marks };
  if (q.answer.kind === "MTA") {
    if ((opts.mtaPolicy ?? "exclude") === "award") return { ...base, status: "correct", marks: q.marks };
    return { ...base, status: "not_scored", marks: 0, maxMarks: 0 };
  }
  if (isResponseEmpty(response)) return { ...base, status: "unanswered", marks: 0 };
  const r = response as UserResponse;
  if (isCorrect(q.answer, r)) return { ...base, status: "correct", marks: q.marks };
  const penalty = q.type === "MCQ" && opts.negativeMarking ? -mcqPenalty(q.marks) : 0;
  return { ...base, status: "incorrect", marks: penalty };
}

export interface GroupStat {
  key: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  marks: number;
  maxMarks: number;
  /** correct / attempted, or null when nothing was attempted. */
  accuracy: number | null;
}

export interface TestScore {
  perQuestion: QuestionScore[];
  score: number;
  maxScore: number;
  positiveMarks: number;
  negativeMarks: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  notScored: number;
  accuracy: number | null;
}

export function accuracy(correct: number, attempted: number): number | null {
  return attempted > 0 ? correct / attempted : null;
}

export function scoreTest(
  questions: ScorableQuestion[],
  responses: Record<string, UserResponse | null | undefined>,
  opts: ScoreOptions,
): TestScore {
  const perQuestion = questions.map((q) => scoreQuestion(q, responses[q.id], opts));
  let score = 0;
  let pos = 0;
  let neg = 0;
  let max = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let notScored = 0;
  for (const s of perQuestion) {
    score += s.marks;
    max += s.maxMarks;
    if (s.marks > 0) pos += s.marks;
    if (s.marks < 0) neg += s.marks;
    if (s.status === "correct") correct++;
    else if (s.status === "incorrect") incorrect++;
    else if (s.status === "unanswered") unanswered++;
    else notScored++;
  }
  const attempted = correct + incorrect;
  return {
    perQuestion,
    score: roundMarks(score),
    maxScore: roundMarks(max),
    positiveMarks: roundMarks(pos),
    negativeMarks: roundMarks(neg),
    attempted,
    correct,
    incorrect,
    unanswered,
    notScored,
    accuracy: accuracy(correct, attempted),
  };
}

/** Group per-question scores by an arbitrary key (subject, topic, type…). */
export function groupScores(
  questions: (ScorableQuestion & Record<string, unknown>)[],
  perQuestion: QuestionScore[],
  keyOf: (q: ScorableQuestion & Record<string, unknown>) => string,
): GroupStat[] {
  const byId = new Map(perQuestion.map((s) => [s.questionId, s]));
  const groups = new Map<string, GroupStat>();
  for (const q of questions) {
    const s = byId.get(q.id);
    if (!s || s.status === "not_scored") continue;
    const k = keyOf(q);
    const g =
      groups.get(k) ??
      ({ key: k, total: 0, attempted: 0, correct: 0, incorrect: 0, unanswered: 0, marks: 0, maxMarks: 0, accuracy: null } as GroupStat);
    g.total++;
    g.maxMarks += s.maxMarks;
    g.marks += s.marks;
    if (s.status === "correct") g.correct++;
    if (s.status === "incorrect") g.incorrect++;
    if (s.status === "unanswered") g.unanswered++;
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    g.attempted = g.correct + g.incorrect;
    g.accuracy = accuracy(g.correct, g.attempted);
    g.marks = roundMarks(g.marks);
    g.maxMarks = roundMarks(g.maxMarks);
  }
  return [...groups.values()];
}

/** Round to 2 decimals (GATE displays marks to two decimals). */
export function roundMarks(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function formatAnswer(answer: Answer): string {
  switch (answer.kind) {
    case "MCQ":
      return answer.correct;
    case "MSQ":
      return [...answer.correct].sort().join(", ");
    case "NAT":
      return answer.min === answer.max ? String(answer.min) : `${answer.min} to ${answer.max}`;
    case "MTA":
      return "Marks to all (official key)";
  }
}

export function formatResponse(r: UserResponse | null | undefined): string {
  if (isResponseEmpty(r)) return "—";
  const x = r as UserResponse;
  if (x.kind === "MCQ") return x.choice;
  if (x.kind === "MSQ") return [...x.choices].sort().join(", ");
  return x.value.trim();
}
