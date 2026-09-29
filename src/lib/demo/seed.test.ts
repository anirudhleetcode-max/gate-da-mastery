import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDb, DEMO_DB_NAME, REAL_DB_NAME } from "@/lib/userdata/db";
import { isCorrect } from "@/lib/scoring/score";
import { DEMO_INFO_KEY, generateDemoData, NotDemoDatabaseError, referencedQuestionIds, writeDemoData, type DemoInput, type DemoMock, type DemoQuestion } from "./seed";

const SUBJECTS = ["ps", "la", "ml", "pdsa"] as const;

function pyq(n: number): DemoQuestion {
  const subjectId = SUBJECTS[n % SUBJECTS.length];
  const kinds = [
    { type: "MCQ", answer: { kind: "MCQ", correct: "B" } },
    { type: "MSQ", answer: { kind: "MSQ", correct: ["A", "C"] } },
    { type: "NAT", answer: { kind: "NAT", min: 0.12, max: 0.13 } },
    { type: "NAT", answer: { kind: "NAT", min: 4, max: 4 } },
  ] as const;
  const k = kinds[n % kinds.length];
  return {
    id: `DA2025-S5-Q${String(10 + n).padStart(2, "0")}`,
    origin: "OFFICIAL_PYQ",
    subjectId,
    topicId: `${subjectId}-topic-${n % 3}`,
    topicName: `Topic ${n % 3}`,
    type: k.type,
    marks: n % 2 ? 2 : 1,
    estimatedTimeSec: 120,
    answer: k.answer,
    title: `GATE DA 2025 · Q.${10 + n}`,
    questionNumber: 10 + n,
  } as DemoQuestion;
}

function mockQ(test: string, n: number): DemoQuestion {
  return {
    id: `M01-Q${String(n).padStart(2, "0")}`,
    origin: "MOCK_TEST",
    subjectId: "la",
    topicId: "la-topic-0",
    topicName: "Topic 0",
    type: n % 2 ? "MCQ" : "NAT",
    marks: 1,
    estimatedTimeSec: 90,
    answer: n % 2 ? { kind: "MCQ", correct: "D" } : { kind: "NAT", min: 2.5, max: 2.5 },
    title: `Mock 1 · Q.${n}`,
    testId: test,
    questionNumber: n,
  };
}

const pyqs = Array.from({ length: 40 }, (_, i) => pyq(i));
const mtaPyq: DemoQuestion = { ...pyq(41), id: "DA2024-S1-Q59", answer: { kind: "MTA", note: "Marks to all" } };
const mockQs = Array.from({ length: 10 }, (_, i) => mockQ("mock-01", i + 1));
const mock: DemoMock = { id: "mock-01", number: 1, durationMinutes: 45, negativeMarking: true, questionIds: mockQs.map((q) => q.id) };
const NOW = new Date("2026-09-20T15:00:00Z");
const input: DemoInput = { questions: [...pyqs, mtaPyq, ...mockQs], mocks: [mock], seed: 42, now: NOW };

describe("generateDemoData", () => {
  it("never produces question ids outside the provided list", () => {
    for (const seed of [1, 2, 42, 999, 123456]) {
      const data = generateDemoData({ ...input, seed });
      const allowed = new Set(input.questions.map((q) => q.id));
      for (const id of referencedQuestionIds(data)) expect(allowed.has(id)).toBe(true);
      for (const m of data.mockAttempts) expect(m.testId).toBe("mock-01");
      for (const r of data.revisionItems) expect(r.key).toBe(`question:${r.refId}`);
      for (const b of data.bookmarks) expect(b.key).toBe(`question:${b.refId}`);
    }
  });

  it("uses only the ids it is given, even when the list is tiny", () => {
    const tiny = pyqs.slice(0, 2);
    const data = generateDemoData({ questions: tiny, seed: 7, now: NOW });
    const ids = referencedQuestionIds(data);
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(tiny.some((q) => q.id === id)).toBe(true);
    expect(data.mockAttempts).toEqual([]);
  });

  it("is deterministic for a fixed seed and date", () => {
    const a = generateDemoData(input);
    const b = generateDemoData({ ...input, questions: [...input.questions].reverse() });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const c = generateDemoData({ ...input, seed: 43 });
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it("skips a mock whose questions were not all provided", () => {
    const data = generateDemoData({ ...input, questions: [...pyqs, ...mockQs.slice(0, 5)] });
    expect(data.mockAttempts).toEqual([]);
    expect([...referencedQuestionIds(data)].some((id) => id.startsWith("M01-"))).toBe(false);
  });

  it("stores responses consistent with each attempt's status and scoring", () => {
    const data = generateDemoData(input);
    const byId = new Map(input.questions.map((q) => [q.id, q]));
    expect(data.attempts.length).toBeGreaterThan(10);
    for (const a of data.attempts) {
      const q = byId.get(a.questionId)!;
      expect(a.createdAt <= NOW.toISOString()).toBe(true);
      if (q.answer.kind === "MTA") {
        expect(a.status).toBe("not_scored");
        continue;
      }
      if (a.status === "unanswered") {
        expect(a.response).toBeNull();
        continue;
      }
      expect(isCorrect(q.answer, a.response!)).toBe(a.status === "correct");
      if (a.status === "correct") expect(a.marksAwarded).toBe(q.marks);
      if (a.status === "incorrect") expect(a.marksAwarded).toBe(q.type === "MCQ" ? -q.marks / 3 : 0);
    }
    // Every incorrect answer is queued for revision and has an error-log entry.
    const incorrect = new Set(data.attempts.filter((a) => a.status === "incorrect").map((a) => a.questionId));
    for (const id of incorrect) {
      expect(data.revisionItems.some((r) => r.refId === id && r.reasons.includes("incorrect"))).toBe(true);
      expect(data.errorLogs.some((e) => e.questionId === id)).toBe(true);
    }
    // Attempt ids are unique; error logs point at existing attempts.
    const attemptIds = new Set(data.attempts.map((a) => a.id));
    expect(attemptIds.size).toBe(data.attempts.length);
    for (const e of data.errorLogs) expect(attemptIds.has(e.attemptId)).toBe(true);
  });

  it("summarises the mock attempt with the real scoring rules", () => {
    const data = generateDemoData(input);
    expect(data.mockAttempts).toHaveLength(1);
    const m = data.mockAttempts[0];
    const rows = data.attempts.filter((a) => a.mockAttemptId === m.id);
    expect(rows).toHaveLength(mockQs.length);
    const score = Math.round(rows.reduce((s, r) => s + r.marksAwarded, 0) * 100) / 100;
    expect(m.result!.score).toBe(score);
    expect(m.result!.correct).toBe(rows.filter((r) => r.status === "correct").length);
    expect(m.status).toBe("submitted");
    expect(data.settings.find((s) => s.key === DEMO_INFO_KEY)).toBeTruthy();
  });
});

describe("writeDemoData", () => {
  it("refuses to write to the real user database", async () => {
    const real = createDb(REAL_DB_NAME);
    await real.open();
    await real.attempts.add({ questionId: "keep-me", origin: "OFFICIAL_PYQ", subjectId: "la", topicId: "t", context: "pyq", response: null, status: "unanswered", marksAwarded: 0, maxMarks: 1, timeSpentMs: 0, createdAt: NOW.toISOString(), day: "2026-09-20" });
    await expect(writeDemoData(real, generateDemoData(input))).rejects.toBeInstanceOf(NotDemoDatabaseError);
    expect(await real.attempts.count()).toBe(1);
    real.close();
  });

  it("replaces the contents of the demo database", async () => {
    const demo = createDb(DEMO_DB_NAME);
    await demo.open();
    const data = generateDemoData(input);
    await writeDemoData(demo, data);
    await writeDemoData(demo, data); // idempotent: cleared first, so no key collisions
    expect(await demo.attempts.count()).toBe(data.attempts.length);
    expect(await demo.bookmarks.count()).toBe(data.bookmarks.length);
    expect(await demo.mockAttempts.count()).toBe(1);
    demo.close();
  });
});
