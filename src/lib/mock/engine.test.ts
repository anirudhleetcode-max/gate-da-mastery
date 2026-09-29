/**
 * Unit tests for the mock-test engine (palette, session reducer, timer,
 * structure, analysis and IndexedDB persistence).
 *
 * The repository's vitest config only includes tests/**; run these with
 *   npx vitest run --config <config including src/lib/mock/**\/*.test.ts>
 * or move/re-export them into tests/ (see the mock group's summary).
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExamPattern } from "@/lib/content/schema";
import type { QuestionPayload } from "@/lib/server/payload";
import { createDb, type AttemptRow, type GateDaDB, type MockQuestionState } from "@/lib/userdata/db";
import { setSetting } from "@/lib/userdata/ops";
import { paletteAriaLabel, paletteCounts, paletteState } from "./palette";
import { createAttempt, examReducer, reconcileAttempt, sectionStarts, timeUsedMs, type ExamState } from "./session";
import { timeAlertLevel, timeAlertMessage, isTimeWarning } from "./timer";
import { displayTotalMarks, markingRules, negativeHint, sectionStructure, shortTitle, toSummary, typeCounts } from "./structure";
import { formatSeconds, signedMarks, stemSnippetHtml } from "./format";
import { computeDiagnostics, historicalWeakTopics, matchesReviewFilter, median, scoreAttempt, weakTopicsInMock, type ScoredQuestion } from "./analysis";
import { discardInProgress, finalizeAttempt, findInProgress, saveProgress, saveSubmission, startOrResume } from "./persist";
import type { KeyResponse, MockTestDef } from "./types";

const q = (over: Partial<MockQuestionState> = {}): MockQuestionState => ({ response: null, markedForReview: false, visited: true, timeSpentMs: 0, ...over });

// ------------------------------------------------------------------ palette

describe("palette state", () => {
  it("derives the five GATE states", () => {
    expect(paletteState(undefined)).toBe("not_visited");
    expect(paletteState(q({ visited: false }))).toBe("not_visited");
    expect(paletteState(q())).toBe("not_answered");
    expect(paletteState(q({ response: { kind: "MCQ", choice: "A" } }))).toBe("answered");
    expect(paletteState(q({ markedForReview: true }))).toBe("marked");
    expect(paletteState(q({ response: { kind: "NAT", value: "3" }, markedForReview: true }))).toBe("answered_marked");
  });
  it("treats empty MSQ and blank NAT responses as unanswered", () => {
    expect(paletteState(q({ response: { kind: "MSQ", choices: [] } }))).toBe("not_answered");
    expect(paletteState(q({ response: { kind: "NAT", value: "  " } }))).toBe("not_answered");
  });
  it("counts states and labels buttons without relying on colour", () => {
    const qs = { a: q({ response: { kind: "MCQ", choice: "B" } }), b: q({ markedForReview: true }), c: q({ visited: false }) };
    expect(paletteCounts(["a", "b", "c", "d"], qs)).toEqual({ not_visited: 2, not_answered: 0, answered: 1, marked: 1, answered_marked: 0 });
    expect(paletteAriaLabel(7, "answered_marked", true)).toBe("Question 7, answered & marked for review, current question");
  });
});

// ------------------------------------------------------------------ session reducer

describe("exam reducer", () => {
  const ids = ["a", "b", "c"];
  const start = (): ExamState => ({ attempt: createAttempt({ id: "mock-01", durationMinutes: 30 }, ids, { id: "x", now: new Date("2026-09-01T10:00:00Z") }), order: ids });

  it("starts with the first question visited and the full duration", () => {
    const s = start();
    expect(s.attempt.remainingMs).toBe(30 * 60_000);
    expect(s.attempt.questions.a.visited).toBe(true);
    expect(s.attempt.questions.b.visited).toBe(false);
  });

  it("counts down and tracks time on the visible question only", () => {
    let s = examReducer(start(), { type: "tick", deltaMs: 5000, visible: true });
    s = examReducer(s, { type: "tick", deltaMs: 2000, visible: false });
    expect(s.attempt.remainingMs).toBe(30 * 60_000 - 7000);
    expect(s.attempt.questions.a.timeSpentMs).toBe(5000);
    s = examReducer(s, { type: "tick", deltaMs: 99 * 60_000, visible: true });
    expect(s.attempt.remainingMs).toBe(0);
    expect(timeUsedMs(s.attempt)).toBe(30 * 60_000);
  });

  it("implements Save & next, Mark for review & next and Clear response like GATE", () => {
    let s = examReducer(start(), { type: "respond", id: "a", response: { kind: "MCQ", choice: "B" } });
    s = examReducer(s, { type: "markAndNext" });
    expect(paletteState(s.attempt.questions.a)).toBe("answered_marked");
    expect(s.attempt.currentIndex).toBe(1);
    expect(paletteState(s.attempt.questions.b)).toBe("not_answered");
    s = examReducer(s, { type: "goto", index: 0 });
    s = examReducer(s, { type: "saveAndNext" });
    expect(paletteState(s.attempt.questions.a)).toBe("answered");
    s = examReducer(s, { type: "previous" });
    s = examReducer(s, { type: "markAndNext" });
    s = examReducer(s, { type: "previous" });
    s = examReducer(s, { type: "clear" });
    expect(paletteState(s.attempt.questions.a)).toBe("marked");
  });

  it("stays on the last question and ignores actions after submission", () => {
    let s = examReducer(start(), { type: "goto", index: 2 });
    s = examReducer(s, { type: "saveAndNext" });
    expect(s.attempt.currentIndex).toBe(2);
    const done = { ...s, attempt: { ...s.attempt, status: "submitted" as const } };
    expect(examReducer(done, { type: "previous" })).toBe(done);
  });

  it("reconciles a saved attempt with the current paper without dropping answers", () => {
    const s = examReducer(start(), { type: "respond", id: "a", response: { kind: "NAT", value: "4" } });
    const r = reconcileAttempt({ ...s.attempt, currentIndex: 10 }, [...ids, "d"]);
    expect(r.currentIndex).toBe(3);
    expect(r.questions.d.visited).toBe(true);
    expect(r.questions.a.response).toEqual({ kind: "NAT", value: "4" });
  });

  it("finds contiguous sections", () => {
    expect(sectionStarts(["GA", "GA", "DA", "DA", "DA"])).toEqual([
      { section: "GA", start: 0, end: 1 },
      { section: "DA", start: 2, end: 4 },
    ]);
  });
});

// ------------------------------------------------------------------ timer

describe("timer rules", () => {
  it("announces 30/10/5/1 minutes once each and skips thresholds not shorter than the test", () => {
    expect(timeAlertLevel(30 * 60_000, 30 * 60_000)).toBeNull();
    expect(timeAlertLevel(29 * 60_000, 45 * 60_000)).toBe(30);
    expect(timeAlertLevel(9 * 60_000, 45 * 60_000)).toBe(10);
    expect(timeAlertLevel(4 * 60_000, 45 * 60_000)).toBe(5);
    expect(timeAlertLevel(59_000, 45 * 60_000)).toBe(1);
    expect(timeAlertMessage(1)).toMatch(/submits automatically/);
    expect(isTimeWarning(10 * 60_000)).toBe(true);
    expect(isTimeWarning(10 * 60_000 + 1)).toBe(false);
  });
});

// ------------------------------------------------------------------ structure & format

const pattern = { marking: { mcqNegativeFraction: 1 / 3, msqNegative: 0, natNegative: 0, msqPartialCredit: false, status: "PARTIALLY_VERIFIED", sourceIds: [] } } as unknown as ExamPattern;

describe("structure and formatting", () => {
  it("builds the GA/DA section plan and type counts", () => {
    const paper = [
      ...Array.from({ length: 10 }, (_, i) => ({ section: "GA" as const, marks: i < 5 ? 1 : 2, type: "MCQ" as const })),
      ...Array.from({ length: 55 }, (_, i) => ({ section: "DA" as const, marks: i < 25 ? 1 : 2, type: i % 3 === 0 ? ("NAT" as const) : ("MCQ" as const) })),
    ];
    expect(sectionStructure(paper).map((s) => [s.section, s.firstQ, s.lastQ, s.marks])).toEqual([
      ["GA", 1, 10, 15],
      ["DA", 11, 65, 85],
    ]);
    expect(typeCounts(paper)).toEqual({ MCQ: 46, MSQ: 0, NAT: 19 });
  });

  it("describes the marking scheme from the exam pattern", () => {
    expect(negativeHint("MCQ", 2, true, pattern)).toBe("Wrong answer: −2/3 mark");
    expect(negativeHint("MCQ", 1, false, pattern)).toBe("No negative marking");
    expect(negativeHint("MSQ", 2, true, pattern)).toBe("No negative marking");
    const rules = Object.fromEntries(markingRules(pattern, true).map((r) => [r.label, r.value]));
    expect(rules["Wrong MCQ"]).toBe("−1/3 for a 1-mark MCQ, −2/3 for a 2-mark MCQ");
    expect(rules["Wrong MSQ or NAT"]).toBe("No negative marking");
  });

  it("only shows a total for complete papers (or the fixed full-GATE total)", () => {
    expect(displayTotalMarks({ available: true, totalMarks: 20, tier: "FOUNDATION" })).toBe(20);
    expect(displayTotalMarks({ available: false, totalMarks: 12, tier: "FOUNDATION" })).toBeNull();
    expect(displayTotalMarks({ available: false, totalMarks: 0, tier: "FULL_GATE" })).toBe(100);
    const test = { id: "mock-08", number: 8, tier: "FOUNDATION", title: "Mock 8: Foundation", description: "", questionIds: ["x", "y"], durationMinutes: 30, negativeMarking: true, totalMarks: 3, available: true } as unknown as MockTestDef;
    const s = toSummary(test, [
      { subjectId: "ml", marks: 1 },
      { subjectId: "ps", marks: 2 },
    ]);
    expect(s.shortTitle).toBe("Foundation");
    expect(s.subjects).toEqual(["ps", "ml"]);
    expect(shortTitle("Mock 7: Foundation — Machine Learning")).toBe("Foundation — Machine Learning");
  });

  it("formats times, signed marks and list snippets", () => {
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(125)).toBe("2:05");
    expect(formatSeconds(3725)).toBe("1:02:05");
    expect(signedMarks(-2 / 3)).toBe("−0.67");
    expect(signedMarks(2)).toBe("+2");
    expect(signedMarks(0)).toBe("0");
    const stem = '<p>Consider the matrix</p><p><span class="math-tex" data-display="false">A = \\begin{bmatrix} 1 &#x26; 2 \\end{bmatrix}</span></p><p>Find its rank.</p>';
    expect(stemSnippetHtml(stem)).toBe("Consider the matrix … Find its rank.");
  });
});

// ------------------------------------------------------------------ analysis

function payload(id: string, over: Partial<QuestionPayload> = {}): QuestionPayload {
  return {
    id,
    origin: "MOCK_TEST",
    subjectId: "ml",
    topicId: "ml-regression",
    topicName: "Regression",
    subtopicIds: [],
    subtopicNames: [],
    subjectName: "Machine Learning",
    type: "MCQ",
    marks: 1,
    difficulty: "EASY",
    estimatedTimeSec: 60,
    preview: "",
    verification: "VERIFIED",
    testId: "mock-06",
    questionNumber: Number(id.slice(1)),
    html: { stem: "<p>Q</p>", options: [], quick: "", steps: [], finalAnswer: "" },
    answer: { kind: "MCQ", correct: "A" },
    difficultyRationale: "",
    conceptIds: [],
    formulaIds: [],
    similarIds: [],
    sourceIds: [],
    answerVerification: {} as QuestionPayload["answerVerification"],
    sources: [],
    concepts: [],
    formulas: [],
    similar: [],
    ...over,
  } as QuestionPayload;
}

const KEY_QUESTIONS = [
  payload("Q1"),
  payload("Q2", { marks: 2 }),
  payload("Q3", { type: "MSQ", answer: { kind: "MSQ", correct: ["A", "C"] } }),
  payload("Q4", { type: "NAT", answer: { kind: "NAT", min: 2.4, max: 2.6 }, topicId: "ml-clustering", topicName: "Clustering" }),
  payload("Q5", { difficulty: "HARD", topicId: "ml-clustering", topicName: "Clustering" }),
  payload("Q6", { difficulty: "MODERATE", marks: 2 }),
];

describe("scoring and diagnostics", () => {
  const attempt = {
    questions: {
      Q1: q({ response: { kind: "MCQ", choice: "A" }, timeSpentMs: 30_000 }),
      Q2: q({ response: { kind: "MCQ", choice: "B" }, timeSpentMs: 200_000, confidence: "high" }),
      Q3: q({ response: { kind: "MSQ", choices: ["A"] }, timeSpentMs: 40_000 }),
      Q4: q({ response: { kind: "NAT", value: "2.5" }, timeSpentMs: 50_000 }),
      Q5: q({ markedForReview: true }),
      Q6: q({ visited: false }),
    },
  };

  it("scores with GATE negative marking (MCQ only, no partial MSQ credit)", () => {
    const r = scoreAttempt(KEY_QUESTIONS, attempt, true);
    expect(r.items.map((i) => [i.id, i.status, Math.round(i.awarded * 100) / 100])).toEqual([
      ["Q1", "correct", 1],
      ["Q2", "incorrect", -0.67],
      ["Q3", "incorrect", 0],
      ["Q4", "correct", 1],
      ["Q5", "unanswered", 0],
      ["Q6", "unanswered", 0],
    ]);
    expect(r.score.score).toBe(1.33);
    expect(r.score.maxScore).toBe(8);
    expect(scoreAttempt(KEY_QUESTIONS, attempt, false).score.score).toBe(2);
  });

  it("finds slow questions, high-confidence errors, skips, penalties and repeats", () => {
    const { items } = scoreAttempt(KEY_QUESTIONS, attempt, true);
    const history: Pick<AttemptRow, "questionId" | "topicId" | "status" | "createdAt" | "mockAttemptId">[] = [
      { questionId: "Q2", topicId: "ml-regression", status: "incorrect", createdAt: "2026-09-01T00:00:00Z" },
      { questionId: "Q3", topicId: "ml-regression", status: "incorrect", createdAt: "2026-09-30T00:00:00Z", mockAttemptId: "this" },
    ];
    const d = computeDiagnostics(items, history, { attemptId: "this", before: "2026-09-29T00:00:00Z" });
    expect(d.medianTimeMs).toBe(45_000);
    expect(d.slow.map((s) => [s.item.id, s.overEstimate, s.overMedian])).toEqual([["Q2", true, true]]);
    expect(d.highConfidenceWrong.map((i) => i.id)).toEqual(["Q2"]);
    expect(d.skippedHard.map((i) => i.id)).toEqual(["Q5"]);
    expect(d.skippedEasy.map((i) => i.id)).toEqual(["Q6"]);
    expect(d.skippedEasyMarks).toBe(2);
    expect(d.penalised.map((i) => i.id)).toEqual(["Q2"]);
    expect(d.totalPenalty).toBe(0.67);
    expect(d.markedUnanswered.map((i) => i.id)).toEqual(["Q5"]);
    expect(d.repeatedQuestions.map((r) => [r.item.id, r.earlierWrong])).toEqual([["Q2", 1]]);
    expect(d.repeatedTopics).toEqual([{ topicId: "ml-regression", topicName: "Regression", subjectId: "ml", wrongHere: 2, wrongEarlier: 1 }]);
  });

  it("flags weak topics in the mock and across history", () => {
    const { items } = scoreAttempt(KEY_QUESTIONS, attempt, true);
    expect(weakTopicsInMock(items).map((t) => [t.topicId, t.correct, t.attempted])).toEqual([["ml-regression", 1, 3]]);
    const rows: Pick<AttemptRow, "topicId" | "status">[] = [
      ...[...Array(3)].map(() => ({ topicId: "ml-clustering", status: "incorrect" as const })),
      { topicId: "ml-clustering", status: "correct" },
    ];
    expect(historicalWeakTopics(new Set(["ml-clustering"]), rows).map((t) => [t.topicId, t.incorrect])).toEqual([["ml-clustering", 3]]);
    expect(median([3, 1, 2, 10])).toBe(2.5);
  });

  it("filters the review list", () => {
    const i = { status: "unanswered", markedForReview: true } as Pick<ScoredQuestion, "status" | "markedForReview">;
    expect(matchesReviewFilter(i, "skipped")).toBe(true);
    expect(matchesReviewFilter(i, "marked")).toBe(true);
    expect(matchesReviewFilter(i, "incorrect")).toBe(false);
  });
});

// ------------------------------------------------------------------ persistence

describe("persistence", () => {
  let db: GateDaDB;
  let n = 0;
  const test = { id: "mock-06", number: 6, durationMinutes: 30, negativeMarking: true, questionIds: KEY_QUESTIONS.map((x) => x.id) } as unknown as MockTestDef;
  const key: KeyResponse = { test, questions: KEY_QUESTIONS };
  const ids = KEY_QUESTIONS.map((x) => x.id);
  beforeEach(async () => {
    db = createDb(`mock-engine-${n++}`);
    await db.open();
  });

  it("creates one attempt and resumes it, even under concurrent starts", async () => {
    let k = 0;
    const [a, b] = await Promise.all([startOrResume(db, test, ids, { newId: () => `id-${k++}` }), startOrResume(db, test, ids, { newId: () => `id-${k++}` })]);
    expect(a.attempt.id).toBe(b.attempt.id);
    expect([a.resumed, b.resumed].sort()).toEqual([false, true]);
    expect(await db.mockAttempts.count()).toBe(1);
    expect((await findInProgress(db, "mock-06"))?.id).toBe(a.attempt.id);
  });

  it("never overwrites a submitted attempt and does not resurrect a discarded one", async () => {
    const { attempt } = await startOrResume(db, test, ids);
    expect(await saveProgress(db, { ...attempt, remainingMs: 1000 })).toBe("saved");
    await saveSubmission(db, attempt, new Date("2026-09-29T10:00:00Z"));
    expect(await saveProgress(db, attempt)).toBe("submitted");
    const other = await startOrResume(db, test, ids);
    expect(await discardInProgress(db, other.attempt.id)).toBe(true);
    expect(await saveProgress(db, other.attempt)).toBe("missing");
    expect(await discardInProgress(db, attempt.id)).toBe(false);
  });

  it("scores once and records attempts, revision items and error-log entries", async () => {
    const { attempt } = await startOrResume(db, test, ids);
    const answered = {
      ...attempt,
      questions: { ...attempt.questions, Q1: q({ response: { kind: "MCQ", choice: "A" } }), Q2: q({ response: { kind: "MCQ", choice: "C" }, confidence: "high" }) },
    };
    await saveSubmission(db, answered);
    const final = await finalizeAttempt(db, attempt.id, key);
    expect(final.status).toBe("submitted");
    expect(final.result).toMatchObject({ correct: 1, incorrect: 1, unanswered: 4, attempted: 2 });
    expect(final.result!.score).toBe(0.33);
    const rows = await db.attempts.toArray();
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.context === "mock" && r.mockAttemptId === attempt.id)).toBe(true);
    expect(rows.find((r) => r.questionId === "Q2")).toMatchObject({ status: "incorrect", confidence: "high", maxMarks: 2 });
    expect(await db.revisionItems.count()).toBe(1);
    expect(await db.errorLogs.count()).toBe(1);
    await finalizeAttempt(db, attempt.id, key);
    expect(await db.attempts.count()).toBe(6);
  });

  it("respects the autoErrorLog setting", async () => {
    await setSetting(db, "autoErrorLog", false);
    const { attempt } = await startOrResume(db, test, ids);
    await saveSubmission(db, { ...attempt, questions: { ...attempt.questions, Q1: q({ response: { kind: "MCQ", choice: "D" } }) } });
    await finalizeAttempt(db, attempt.id, key);
    expect(await db.revisionItems.count()).toBe(1);
    expect(await db.errorLogs.count()).toBe(0);
  });
});
