import { describe, expect, it } from "vitest";
import type { PoolQuestion } from "@/lib/practice/pool";
import { questionHistory } from "@/lib/practice/pool";
import { DEFAULT_DAILY_CONFIG, includedSubjects, normalizeDailyConfig, type DailyConfig } from "./config";
import { buildDailyPlan, dueAtStartOfDay, stateAtStartOfDay, suggestTopic, type DailyPlanInput } from "./plan";
import { dayNumber, hashString, mulberry32, shuffle, weightedSample } from "./random";

const DA = ["ps", "la", "co", "pdsa", "dbw", "ml", "ai"];
const SUBJECTS = [...DA, "ga"];

function makePool(): PoolQuestion[] {
  const out: PoolQuestion[] = [];
  let n = 0;
  for (const s of SUBJECTS)
    for (let t = 0; t < 3; t++)
      for (let i = 0; i < 6; i++) {
        n++;
        out.push({
          id: `${s}-t${t}-q${i}`,
          origin: i % 2 ? "ORIGINAL_PRACTICE" : "OFFICIAL_PYQ",
          subjectId: s as PoolQuestion["subjectId"],
          topicId: `${s}-t${t}`,
          type: "MCQ",
          marks: 1,
          difficulty: (["EASY", "MODERATE", "HARD", "VERY_HARD"] as const)[i % 4],
          estimatedTimeSec: 120,
          year: 2024 + (n % 3),
          questionNumber: (n % 65) + 1,
        });
      }
  // Mock questions must never enter the daily plan.
  out.push({ id: "mock-q", origin: "MOCK_TEST", subjectId: "ps", topicId: "ps-t0", type: "MCQ", marks: 1, difficulty: "EASY", estimatedTimeSec: 60, testId: "mock-01" });
  return out;
}

function input(over: Partial<DailyPlanInput> = {}): DailyPlanInput {
  return {
    day: "2026-09-29",
    pool: makePool(),
    history: new Map(),
    weakTopicIds: [],
    dueRevision: [],
    concepts: SUBJECTS.flatMap((s) => [0, 1, 2].map((t) => ({ id: `c-${s}-${t}`, subjectId: s, topicId: `${s}-t${t}` }))),
    formulas: SUBJECTS.flatMap((s) => [0, 1, 2].map((t) => ({ id: `f-${s}-${t}`, subjectId: s, topicId: `${s}-t${t}` }))),
    topicWeights: new Map([["la-t1", 20]]),
    config: DEFAULT_DAILY_CONFIG,
    daSubjectIds: DA,
    ...over,
  };
}

describe("seeded random helpers", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashString("2026-09-29")).toBe(hashString("2026-09-29"));
    expect(hashString("2026-09-29")).not.toBe(hashString("2026-09-30"));
  });
  it("shuffles without losing items and samples by weight", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect([...shuffle(xs, mulberry32(1))].sort((a, b) => a - b)).toEqual(xs);
    const s = weightedSample(xs, 5, (x) => (x < 5 ? 0 : 1), mulberry32(3));
    expect(s).toHaveLength(5);
    expect(s.every((x) => x >= 5)).toBe(true);
  });
  it("computes day numbers independent of time zone", () => {
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-09-30") - dayNumber("2026-09-29")).toBe(1);
  });
});

describe("daily config", () => {
  it("normalises stored values", () => {
    expect(normalizeDailyConfig(undefined)).toEqual(DEFAULT_DAILY_CONFIG);
    expect(normalizeDailyConfig({ count: 7, subjects: ["ml", 3, "ga"], includeGA: false })).toEqual({ count: 10, subjects: ["ml"], includeGA: false });
    const cfg: DailyConfig = { count: 5, subjects: ["ml"], includeGA: true };
    expect([...includedSubjects(cfg, DA)].sort()).toEqual(["ga", "ml"]);
  });
});

describe("buildDailyPlan", () => {
  it("is deterministic for the same day and different on another day", () => {
    const a = buildDailyPlan(input());
    const b = buildDailyPlan(input());
    const c = buildDailyPlan(input({ day: "2026-09-30" }));
    expect(a).toEqual(b);
    expect(a.questionIds).not.toEqual(c.questionIds);
  });

  it("returns the requested number of distinct questions and never mock questions", () => {
    for (const count of [5, 10, 15, 20] as const) {
      const p = buildDailyPlan(input({ config: { ...DEFAULT_DAILY_CONFIG, count } }));
      expect(p.questionIds).toHaveLength(count);
      expect(new Set(p.questionIds).size).toBe(count);
      expect(p.questionIds).not.toContain("mock-q");
      expect(p.weakExercise?.questionIds).not.toContain("mock-q");
    }
  });

  it("keeps the weak-topic exercise separate from the main set", () => {
    const p = buildDailyPlan(input({ weakTopicIds: ["ml-t2"] }));
    expect(p.weakExercise).toMatchObject({ topicId: "ml-t2", basis: "weakest" });
    expect(p.weakExercise!.questionIds).toHaveLength(5);
    for (const id of p.weakExercise!.questionIds) expect(p.questionIds).not.toContain(id);
  });

  it("biases the set toward weak topics", () => {
    const p = buildDailyPlan(input({ weakTopicIds: ["la-t0", "la-t1"] }));
    const weakQs = p.questionIds.filter((id) => id.startsWith("la-t0") || id.startsWith("la-t1"));
    expect(weakQs.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(p.reasons).filter((r) => r === "weak").length).toBeGreaterThanOrEqual(3);
  });

  it("prefers unattempted questions", () => {
    const pool = makePool();
    const attempts = pool
      .filter((q) => q.origin !== "MOCK_TEST" && !q.id.startsWith("ai-"))
      .map((q) => ({ questionId: q.id, status: "correct" as const, createdAt: "2026-09-01T10:00:00Z" }));
    const p = buildDailyPlan(input({ history: questionHistory(attempts) }));
    const fresh = p.questionIds.filter((id) => id.startsWith("ai-"));
    // Only "ai" questions are unattempted; the subject cap limits how many one subject contributes.
    expect(fresh.length).toBeGreaterThanOrEqual(3);
  });

  it("respects the subject settings and General Aptitude switch", () => {
    const p = buildDailyPlan(input({ config: { count: 10, subjects: ["ml"], includeGA: false } }));
    expect(p.questionIds.every((id) => id.startsWith("ml-"))).toBe(true);
    expect(p.formulaIds.every((id) => id.startsWith("f-ml-"))).toBe(true);
    expect(p.conceptId?.startsWith("c-ml-")).toBe(true);
    const noGa = buildDailyPlan(input({ config: { ...DEFAULT_DAILY_CONFIG, includeGA: false } }));
    expect(noGa.questionIds.some((id) => id.startsWith("ga-"))).toBe(false);
  });

  it("is honest when the pool is smaller than requested", () => {
    const pool = makePool().filter((q) => q.subjectId === "ml").slice(0, 7);
    const p = buildDailyPlan(input({ pool, config: { count: 10, subjects: ["ml"], includeGA: false } }));
    expect(p.requested).toBe(10);
    expect(p.questionIds.length + (p.weakExercise?.questionIds.length ?? 0)).toBe(7);
  });

  it("picks 5 formulas, a concept from a weak topic, and up to 10 revision keys", () => {
    const due = Array.from({ length: 14 }, (_, i) => ({ key: `question:x${i}`, nextReview: `2026-09-${String(10 + i).padStart(2, "0")}`, topicId: "ps-t0" }));
    const p = buildDailyPlan(input({ weakTopicIds: ["co-t1"], dueRevision: due }));
    expect(p.formulaIds).toHaveLength(5);
    expect(new Set(p.formulaIds).size).toBe(5);
    expect(p.formulaIds).toContain("f-co-1");
    expect(p.conceptId).toBe("c-co-1");
    expect(p.revisionKeys).toEqual(due.slice(0, 10).map((d) => d.key));
  });

  it("does not repeat questions that are already in today's revision set", () => {
    const pool = makePool().filter((q) => q.subjectId === "ps");
    const due = pool.slice(0, 10).map((q) => ({ key: `question:${q.id}`, nextReview: "2026-09-29", topicId: q.topicId }));
    const p = buildDailyPlan(input({ pool, dueRevision: due, config: { count: 5, subjects: ["ps"], includeGA: false } }));
    for (const d of due) expect(p.questionIds).not.toContain(d.key.slice(9));
  });

  it("handles an empty library", () => {
    const p = buildDailyPlan(input({ pool: [], concepts: [], formulas: [] }));
    expect(p).toMatchObject({ questionIds: [], weakExercise: null, conceptId: null, formulaIds: [], revisionKeys: [] });
  });
});

describe("suggested topic and start-of-day state", () => {
  it("suggests a heavily weighted, unpractised topic", () => {
    const pool = makePool().filter((q) => q.subjectId === "la");
    const picks = new Set([0, 1, 2].map((d) => suggestTopic(pool, new Map(), new Map([["la-t1", 20]]), d)));
    expect(picks.has("la-t1")).toBe(true);
  });

  it("uses only attempts before today, so the plan does not change while you work", () => {
    const rows = [
      { questionId: "a", status: "incorrect" as const, createdAt: "2026-09-28T10:00:00Z", day: "2026-09-28", topicId: "t" },
      { questionId: "b", status: "correct" as const, createdAt: "2026-09-29T10:00:00Z", day: "2026-09-29", topicId: "t" },
    ];
    const s = stateAtStartOfDay(rows, "2026-09-29");
    expect([...s.history.keys()]).toEqual(["a"]);
  });

  it("keeps items reviewed today in today's revision set", () => {
    const items = [
      { key: "a", nextReview: "2026-09-29", lastReviewed: null },
      { key: "b", nextReview: "2026-10-05", lastReviewed: null },
      { key: "c", nextReview: "2026-10-02", lastReviewed: new Date(2026, 8, 29, 10).toISOString() },
    ];
    expect(dueAtStartOfDay(items, "2026-09-29").map((i) => i.key)).toEqual(["a", "c"]);
  });
});
