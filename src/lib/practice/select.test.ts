import { describe, expect, it } from "vitest";
import { historyState, questionHistory, toPoolQuestion, type PoolQuestion } from "./pool";
import {
  DEFAULT_PRACTICE_FILTERS,
  eligiblePool,
  matchPractice,
  nearestCount,
  parsePracticeQuery,
  resolveExplicitIds,
  selectPractice,
  timeLimitSec,
  type PracticeFilters,
} from "./select";

const q = (id: string, over: Partial<PoolQuestion> = {}): PoolQuestion => ({
  id,
  origin: "OFFICIAL_PYQ",
  subjectId: "ml",
  topicId: "ml-a",
  type: "MCQ",
  marks: 1,
  difficulty: "MODERATE",
  estimatedTimeSec: 150,
  ...over,
});

const POOL: PoolQuestion[] = [
  ...Array.from({ length: 30 }, (_, i) => q(`pyq-${i}`, { subjectId: i % 2 ? "ml" : "la", topicId: i % 2 ? "ml-a" : "la-b", difficulty: i % 3 ? "MODERATE" : "EASY", year: 2024 + (i % 3), questionNumber: i + 1 })),
  ...Array.from({ length: 10 }, (_, i) => q(`prac-${i}`, { origin: "ORIGINAL_PRACTICE", topicId: "ml-a" })),
  q("m1-q1", { origin: "MOCK_TEST", testId: "mock-01" }),
  q("m2-q1", { origin: "MOCK_TEST", testId: "mock-02" }),
];

const f = (over: Partial<PracticeFilters> = {}): PracticeFilters => ({ ...DEFAULT_PRACTICE_FILTERS, ...over });

describe("eligibility", () => {
  it("only admits questions of submitted mocks", () => {
    const e = eligiblePool(POOL, new Set(["mock-02"]));
    expect(e.some((x) => x.id === "m1-q1")).toBe(false);
    expect(e.some((x) => x.id === "m2-q1")).toBe(true);
    expect(eligiblePool(POOL, new Set()).some((x) => x.origin === "MOCK_TEST")).toBe(false);
  });
});

describe("history", () => {
  it("tracks the latest scored attempt and ignores skipped mock questions", () => {
    const h = questionHistory([
      { questionId: "a", status: "incorrect", createdAt: "2026-01-01" },
      { questionId: "a", status: "correct", createdAt: "2026-01-02" },
      { questionId: "b", status: "correct", createdAt: "2026-01-01" },
      { questionId: "b", status: "incorrect", createdAt: "2026-01-03" },
      { questionId: "c", status: "unanswered", createdAt: "2026-01-03" },
    ]);
    expect(historyState(h.get("a"))).toBe("correct");
    expect(historyState(h.get("b"))).toBe("incorrect");
    expect(historyState(h.get("c"))).toBe("unattempted");
    expect(historyState(undefined)).toBe("unattempted");
  });
});

describe("matching", () => {
  const pool = eligiblePool(POOL, new Set(["mock-01"]));
  it("filters by subject, topic, difficulty and source", () => {
    expect(matchPractice(pool, f({ subjectId: "la" }), new Map()).every((x) => x.subjectId === "la")).toBe(true);
    expect(matchPractice(pool, f({ source: "pyq" }), new Map()).every((x) => x.origin === "OFFICIAL_PYQ")).toBe(true);
    const orig = matchPractice(pool, f({ source: "original" }), new Map());
    expect(orig.map((x) => x.origin).sort()).toEqual([...Array(1).fill("MOCK_TEST"), ...Array(10).fill("ORIGINAL_PRACTICE")]);
    expect(matchPractice(pool, f({ difficulties: ["EASY"] }), new Map()).every((x) => x.difficulty === "EASY")).toBe(true);
    expect(matchPractice(pool, f({ topicId: "la-b" }), new Map())).toHaveLength(15);
  });
  it("filters by status", () => {
    const h = questionHistory([
      { questionId: "pyq-0", status: "incorrect", createdAt: "2026-01-01" },
      { questionId: "pyq-1", status: "correct", createdAt: "2026-01-01" },
    ]);
    expect(matchPractice(pool, f({ status: "incorrect" }), h).map((x) => x.id)).toEqual(["pyq-0"]);
    const un = matchPractice(pool, f({ status: "unattempted" }), h);
    expect(un.some((x) => x.id === "pyq-0" || x.id === "pyq-1")).toBe(false);
  });
});

describe("selectPractice", () => {
  const pool = eligiblePool(POOL, new Set());
  it("is deterministic for a seed and varies across seeds", () => {
    const a = selectPractice(pool, f({ count: 10 }), new Map(), 7);
    expect(a).toEqual(selectPractice(pool, f({ count: 10 }), new Map(), 7));
    expect(a.ids).not.toEqual(selectPractice(pool, f({ count: 10 }), new Map(), 8).ids);
    expect(new Set(a.ids).size).toBe(10);
  });
  it("reports a smaller pool honestly", () => {
    const s = selectPractice(pool, f({ count: 50, subjectId: "la" }), new Map(), 1);
    expect(s).toMatchObject({ matched: 15, requested: 50 });
    expect(s.ids).toHaveLength(15);
  });
  it("keeps canonical order without shuffle and computes the timed limit", () => {
    const s = selectPractice(pool, f({ count: 5, shuffle: false, timed: true, subjectId: "la" }), new Map(), 3);
    const years = s.ids.map((id) => pool.find((x) => x.id === id)!.year!);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
    expect(s.timeLimitSec).toBe(Math.ceil((5 * 150) / 60) * 60);
    expect(selectPractice(pool, f({ count: 5 }), new Map(), 3).timeLimitSec).toBeNull();
  });
  it("rounds the time limit up to a whole minute", () => {
    expect(timeLimitSec([{ estimatedTimeSec: 61 }])).toBe(120);
    expect(timeLimitSec([{ estimatedTimeSec: 60 }, { estimatedTimeSec: 60 }])).toBe(120);
  });
});

describe("explicit ids and query parameters", () => {
  it("keeps known, eligible ids in order", () => {
    const r = resolveExplicitIds(["prac-2", "nope", "m1-q1", "pyq-3"], POOL, new Set());
    expect(r.questions.map((x) => x.id)).toEqual(["prac-2", "pyq-3"]);
    expect(r.unknown).toEqual(["nope"]);
    expect(r.locked).toEqual(["m1-q1"]);
  });
  it("parses links from other pages", () => {
    const ctx = { subjectIds: new Set(["ml", "la"]), topicSubject: new Map([["ml-a", "ml"]]) };
    expect(parsePracticeQuery({ topic: "ml-a", count: "12" }, ctx).filters).toMatchObject({ subjectId: "ml", topicId: "ml-a", count: 10 });
    expect(parsePracticeQuery({ subject: "zz", count: "50" }, ctx).filters).toMatchObject({ subjectId: "", count: 50 });
    expect(parsePracticeQuery({ ids: "a,b,,a" }, ctx).ids).toEqual(["a", "b"]);
    expect(parsePracticeQuery({ difficulty: "HARD,EASY,X", status: "incorrect", source: "pyq", timed: "1" }, ctx).filters).toMatchObject({
      difficulties: ["EASY", "HARD"],
      status: "incorrect",
      source: "pyq",
      timed: true,
    });
    expect(nearestCount(25)).toBe(30);
    expect(nearestCount(-3)).toBe(10);
  });
  it("converts metadata to pool entries without the preview", () => {
    const p = toPoolQuestion({ ...q("x"), subtopicIds: [], preview: "stem", verification: "VERIFIED" });
    expect(p).not.toHaveProperty("preview");
    expect(p.id).toBe("x");
  });
});
