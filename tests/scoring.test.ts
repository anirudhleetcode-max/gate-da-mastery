import { describe, expect, it } from "vitest";
import { groupScores, isCorrect, mcqPenalty, parseNat, scoreQuestion, scoreTest, formatAnswer, type ScorableQuestion } from "@/lib/scoring/score";

const mcq1: ScorableQuestion = { id: "a", type: "MCQ", marks: 1, answer: { kind: "MCQ", correct: "B" } };
const mcq2: ScorableQuestion = { id: "b", type: "MCQ", marks: 2, answer: { kind: "MCQ", correct: "D" } };
const msq: ScorableQuestion = { id: "c", type: "MSQ", marks: 2, answer: { kind: "MSQ", correct: ["A", "C"] } };
const nat: ScorableQuestion = { id: "d", type: "NAT", marks: 1, answer: { kind: "NAT", min: 0.12, max: 0.13 } };
const mta: ScorableQuestion = { id: "e", type: "NAT", marks: 2, answer: { kind: "MTA", note: "marks to all" } };
const opts = { negativeMarking: true };

describe("MCQ scoring (GATE negative marking)", () => {
  it("awards full marks for the correct option", () => {
    expect(scoreQuestion(mcq1, { kind: "MCQ", choice: "B" }, opts)).toMatchObject({ status: "correct", marks: 1 });
  });
  it("deducts 1/3 for a wrong 1-mark MCQ and 2/3 for a wrong 2-mark MCQ", () => {
    expect(scoreQuestion(mcq1, { kind: "MCQ", choice: "A" }, opts).marks).toBeCloseTo(-1 / 3, 10);
    expect(scoreQuestion(mcq2, { kind: "MCQ", choice: "A" }, opts).marks).toBeCloseTo(-2 / 3, 10);
    expect(mcqPenalty(2)).toBeCloseTo(2 / 3);
  });
  it("gives 0 for an unanswered MCQ", () => {
    expect(scoreQuestion(mcq1, null, opts)).toMatchObject({ status: "unanswered", marks: 0 });
  });
  it("does not penalise when negative marking is off", () => {
    expect(scoreQuestion(mcq1, { kind: "MCQ", choice: "A" }, { negativeMarking: false }).marks).toBe(0);
  });
});

describe("MSQ scoring (exact set, no partial credit, no negative)", () => {
  it("requires exactly the correct set", () => {
    expect(scoreQuestion(msq, { kind: "MSQ", choices: ["C", "A"] }, opts)).toMatchObject({ status: "correct", marks: 2 });
  });
  it("gives 0 (not negative) for a subset or superset", () => {
    expect(scoreQuestion(msq, { kind: "MSQ", choices: ["A"] }, opts)).toMatchObject({ status: "incorrect", marks: 0 });
    expect(scoreQuestion(msq, { kind: "MSQ", choices: ["A", "B", "C"] }, opts)).toMatchObject({ status: "incorrect", marks: 0 });
  });
  it("treats an empty selection as unanswered", () => {
    expect(scoreQuestion(msq, { kind: "MSQ", choices: [] }, opts).status).toBe("unanswered");
  });
});

describe("NAT scoring (inclusive range, no negative)", () => {
  it("accepts values inside the range including both ends", () => {
    for (const v of ["0.12", "0.125", "0.13", " .12 "]) expect(isCorrect(nat.answer, { kind: "NAT", value: v })).toBe(true);
  });
  it("rejects values outside the range with 0 marks", () => {
    expect(scoreQuestion(nat, { kind: "NAT", value: "0.14" }, opts)).toMatchObject({ status: "incorrect", marks: 0 });
    expect(scoreQuestion(nat, { kind: "NAT", value: "0.119" }, opts).status).toBe("incorrect");
  });
  it("parses only well-formed numbers", () => {
    expect(parseNat("-2.5")).toBe(-2.5);
    expect(parseNat("+3")).toBe(3);
    expect(parseNat("1e3")).toBeNull();
    expect(parseNat("abc")).toBeNull();
    expect(parseNat("")).toBeNull();
    expect(isCorrect(nat.answer, { kind: "NAT", value: "0.12abc" })).toBe(false);
  });
  it("handles degenerate integer ranges", () => {
    expect(isCorrect({ kind: "NAT", min: 42, max: 42 }, { kind: "NAT", value: "42" })).toBe(true);
    expect(isCorrect({ kind: "NAT", min: 42, max: 42 }, { kind: "NAT", value: "42.0" })).toBe(true);
    expect(isCorrect({ kind: "NAT", min: 42, max: 42 }, { kind: "NAT", value: "41.99" })).toBe(false);
  });
});

describe("Marks-to-all (MTA)", () => {
  it("is excluded from scoring by default", () => {
    expect(scoreQuestion(mta, { kind: "NAT", value: "1" }, opts)).toMatchObject({ status: "not_scored", marks: 0, maxMarks: 0 });
  });
  it("awards full marks under the 'award' policy even when unanswered", () => {
    expect(scoreQuestion(mta, null, { negativeMarking: true, mtaPolicy: "award" })).toMatchObject({ status: "correct", marks: 2 });
  });
});

describe("scoreTest + groupScores", () => {
  const qs = [mcq1, mcq2, msq, nat, mta].map((q, i) => ({ ...q, subjectId: i < 2 ? "ps" : "ml" }));
  const res = scoreTest(qs, { a: { kind: "MCQ", choice: "B" }, b: { kind: "MCQ", choice: "A" }, c: { kind: "MSQ", choices: ["A", "C"] }, d: null, e: null }, opts);
  it("totals marks with negatives rounded to 2 decimals", () => {
    expect(res.score).toBeCloseTo(1 - 2 / 3 + 2, 2);
    expect(res.maxScore).toBe(6);
    expect(res.negativeMarks).toBeCloseTo(-0.67, 2);
    expect(res).toMatchObject({ correct: 2, incorrect: 1, unanswered: 1, notScored: 1, attempted: 3 });
    expect(res.accuracy).toBeCloseTo(2 / 3);
  });
  it("groups by subject", () => {
    const g = groupScores(qs, res.perQuestion, (q) => q.subjectId as string);
    const ps = g.find((x) => x.key === "ps")!;
    expect(ps).toMatchObject({ total: 2, correct: 1, incorrect: 1 });
    expect(ps.accuracy).toBe(0.5);
    const ml = g.find((x) => x.key === "ml")!;
    expect(ml).toMatchObject({ total: 2, correct: 1, unanswered: 1, accuracy: 1 });
  });
  it("formats answers for display", () => {
    expect(formatAnswer(msq.answer)).toBe("A, C");
    expect(formatAnswer(nat.answer)).toBe("0.12 to 0.13");
  });
});
