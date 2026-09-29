import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { OriginalQuestion, Syllabus } from "@/lib/content/schema";
import { buildTaxonomyIndex } from "@/lib/content/validate";
import { questionHashes, reviewQuestion, type BlueprintSlot } from "@/lib/content/review";

const tax = buildTaxonomyIndex(Syllabus.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "../content/syllabus.json"), "utf8"))));
const slot: BlueprintSlot = { q: 1, section: "DA", subjectId: "ps", topicId: "ps-foundations", subtopicId: "ps-counting", type: "NAT", marks: 1, difficulty: "EASY" };

function q(over: Record<string, unknown> = {}) {
  return OriginalQuestion.parse({
    id: "M01-Q01",
    origin: "MOCK_TEST",
    sourceType: "PLATFORM_CREATED",
    testId: "mock-01",
    questionNumber: 1,
    section: "DA",
    subjectId: "ps",
    topicId: "ps-foundations",
    subtopicIds: ["ps-counting"],
    type: "NAT",
    marks: 1,
    difficulty: "EASY",
    difficultyRationale: "Platform-estimated: one step.",
    stem: "A committee of 3 is chosen from 7 annotators, one of whom is designated lead. How many committees are possible?",
    answer: { kind: "NAT", min: 105, max: 105 },
    solution: { quick: "C(7,3)×3", steps: [{ title: "Choose", body: "C(7,3)=35" }, { title: "Lead", body: "×3 = 105" }], finalAnswer: "**105**" },
    concept: "Counting",
    estimatedTimeSec: 60,
    answerVerification: { status: "VERIFIED", method: "Blind independent re-solve + independent Python check agrees with key", agreesWithKey: true, checkCode: "print(35*3)", notes: "" },
    ...over,
  });
}
const ctx = (corpus: { id: string; text: string; official: boolean }[] = [], previous?: ReturnType<typeof reviewQuestion>) => ({
  tax,
  slot,
  corpus,
  today: "2026-09-29",
  previous: previous ? (({ failures: _f, ...r }) => (void _f, r))(previous) : undefined,
});
const mcq = (over: Record<string, unknown> = {}) =>
  q({
    type: "MCQ",
    stem: "Which estimator of the population variance is unbiased for an i.i.d. sample of size $n$?",
    options: [
      { label: "A", text: "$\\frac{1}{n}\\sum (x_i-\\bar x)^2$" },
      { label: "B", text: "$\\frac{1}{n-1}\\sum (x_i-\\bar x)^2$" },
      { label: "C", text: "$\\frac{1}{n+1}\\sum (x_i-\\bar x)^2$" },
      { label: "D", text: "$\\frac{1}{n^2}\\sum (x_i-\\bar x)^2$" },
    ],
    answer: { kind: "MCQ", correct: "B" },
    solution: {
      quick: "Bessel's correction.",
      steps: [
        { title: "Expectation", body: "$E[\\sum (x_i-\\bar x)^2] = (n-1)\\sigma^2$." },
        { title: "Divide", body: "Divide by $n-1$." },
      ],
      finalAnswer: "**(B)**",
      optionAnalysis: [
        { label: "A", verdict: "incorrect", explanation: "Biased low by a factor $(n-1)/n$." },
        { label: "B", verdict: "correct", explanation: "Unbiased." },
        { label: "C", verdict: "incorrect", explanation: "Biased low." },
        { label: "D", verdict: "incorrect", explanation: "Wrong scale." },
      ],
    },
    ...over,
  });
const mcqSlot: BlueprintSlot = { ...slot, type: "MCQ" };

describe("deterministic mock review gates", () => {
  it("VERIFIED only when the independent solve and every gate pass", () => {
    const r = reviewQuestion(q(), ctx());
    expect(r.status).toBe("VERIFIED");
    expect(Object.values(r.checks).every(Boolean)).toBe(true);
  });
  it("SELF_CHECKED when only the author's check exists", () => {
    const r = reviewQuestion(q({ answerVerification: { status: "PARTIALLY_VERIFIED", method: "Author derivation + Python check", agreesWithKey: true, checkCode: "x", notes: "" } }), ctx());
    expect(r.status).toBe("SELF_CHECKED");
  });
  it("DRAFT without any self-check", () => {
    const r = reviewQuestion(q({ answerVerification: { status: "PARTIALLY_VERIFIED", method: "none", agreesWithKey: true, notes: "" } }), ctx());
    expect(r.status).toBe("DRAFT");
  });
  it("NEEDS_REVIEW when the verifier flags it, even if other gates pass", () => {
    const r = reviewQuestion(q({ answerVerification: { status: "NEEDS_REVIEW", method: "Blind independent re-solve", agreesWithKey: false, notes: "two defensible answers" } }), ctx());
    expect(r.status).toBe("NEEDS_REVIEW");
  });
  it("rejects near-duplicates and copies of official PYQs", () => {
    const stem = q().stem;
    expect(reviewQuestion(q(), ctx([{ id: "M09-Q03", text: stem, official: false }])).status).toBe("NEEDS_REVIEW");
    expect(reviewQuestion(q(), ctx([{ id: "DA2025-S5-Q20", text: stem, official: true }])).checks.original).toBe(false);
  });
  it("rejects blueprint mismatches and implausible times", () => {
    expect(reviewQuestion(q({ marks: 2 }), ctx()).checks.blueprint).toBe(false);
    expect(reviewQuestion(q({ difficulty: "VERY_HARD", difficultyRationale: "Platform-estimated: x" }), ctx()).checks.blueprint).toBe(false);
    expect(reviewQuestion(q({ estimatedTimeSec: 5 }), ctx()).status).toBe("NEEDS_REVIEW");
  });
  it("records corrections made during verification", () => {
    const r = reviewQuestion(q({ answerVerification: { status: "VERIFIED", method: "Blind independent re-solve agrees with key (corrected during verification)", agreesWithKey: true, notes: "fixed option C" } }), ctx());
    expect(r).toMatchObject({ status: "VERIFIED", fixed: true });
  });
});

describe("review status transitions (regression)", () => {
  const withSlot = (c: ReturnType<typeof ctx>, sl: BlueprintSlot) => ({ ...c, slot: sl });

  it("an answer the independent solver agrees with is still rejected if it duplicates another question", () => {
    const r = reviewQuestion(q(), ctx([{ id: "M02-Q07", text: q().stem.replace("annotators", "annotator"), official: false }]));
    expect(r.checks.independentSolve).toBe(true);
    expect(r.checks.noDuplicate).toBe(false);
    expect(r.status).toBe("NEEDS_REVIEW");
  });
  it("an independent solution that disagrees with the key is never VERIFIED", () => {
    const disagree = { status: "NEEDS_REVIEW", method: "Blind independent re-solve", agreesWithKey: false, independentAnswer: "120", notes: "got 120" };
    expect(reviewQuestion(q({ answerVerification: disagree }), ctx()).status).toBe("NEEDS_REVIEW");
    // A verifier record that says VERIFIED without being independent does not count as an independent solve.
    const notIndependent = { status: "VERIFIED", method: "Author re-check", agreesWithKey: true, checkCode: "x", notes: "" };
    expect(reviewQuestion(q({ answerVerification: notIndependent }), ctx()).status).toBe("SELF_CHECKED");
  });
  it("missing or inconsistent metadata blocks verification", () => {
    expect(reviewQuestion(q({ subtopicIds: ["ml-regression-linear"] }), ctx()).status).toBe("NEEDS_REVIEW");
    expect(reviewQuestion(q({ topicId: "ps-nonexistent" }), ctx()).checks.metadata).toBe(false);
  });
  it("incomplete solutions block verification", () => {
    const noFinal = { quick: "x", steps: [{ title: "Choose", body: "C(7,3)=35" }, { title: "Lead", body: "×3" }], finalAnswer: " " };
    expect(reviewQuestion(q({ solution: noFinal }), ctx()).checks.solution).toBe(false);
    const m = mcq();
    const noAnalysis = { ...m.solution, optionAnalysis: undefined };
    expect(reviewQuestion(mcq({ solution: noAnalysis }), withSlot(ctx(), mcqSlot)).status).toBe("NEEDS_REVIEW");
    expect(reviewQuestion(mcq(), withSlot(ctx(), mcqSlot)).status).toBe("VERIFIED");
  });
  it("re-reviewing an already VERIFIED, unchanged question is idempotent", () => {
    const first = reviewQuestion(q(), ctx());
    const again = reviewQuestion(q(), ctx([], first));
    expect(again.status).toBe("VERIFIED");
    expect(again.verifiedHash).toEqual(first.verifiedHash);
    expect(again.checks).toEqual(first.checks);
  });
  it("a question edited after verification drops to NEEDS_REVIEW until it is independently re-verified", () => {
    const first = reviewQuestion(q(), ctx());
    const edited = q({ answer: { kind: "NAT", min: 106, max: 106 } });
    const r = reviewQuestion(edited, ctx([], first));
    expect(r.checks.unchangedSinceVerification).toBe(false);
    expect(r.status).toBe("NEEDS_REVIEW");
    // The verified hash is sticky while blocked, so a second run cannot launder the edit.
    const r2 = reviewQuestion(edited, ctx([], r));
    expect(r2.status).toBe("NEEDS_REVIEW");
    // A fresh independent verification (new verification record) clears it.
    const reverified = q({
      answer: { kind: "NAT", min: 106, max: 106 },
      answerVerification: { status: "VERIFIED", method: "Blind independent re-solve after edit agrees with key", agreesWithKey: true, checkCode: "print(106)", notes: "re-verified" },
    });
    const r3 = reviewQuestion(reverified, ctx([], r2));
    expect(r3.status).toBe("VERIFIED");
    expect(r3.verifiedHash).toEqual(questionHashes(reverified));
  });
  it("a regenerated question (new content and a fresh draft record) starts over from SELF_CHECKED", () => {
    const first = reviewQuestion(q(), ctx());
    const regenerated = q({
      stem: "Five distinct data shards are assigned to 3 servers so that every server gets at least one shard. How many assignments are possible?",
      answer: { kind: "NAT", min: 150, max: 150 },
      answerVerification: { status: "PARTIALLY_VERIFIED", method: "Author derivation + Python check", agreesWithKey: true, checkCode: "print(150)", notes: "" },
    });
    const r = reviewQuestion(regenerated, ctx([], first));
    expect(r.status).toBe("SELF_CHECKED");
    expect(r.checks.unchangedSinceVerification).toBe(true);
  });
  it("blueprint violations (type, section, number, subject) are all caught", () => {
    expect(reviewQuestion(q(), withSlot(ctx(), { ...slot, type: "MCQ" })).checks.blueprint).toBe(false);
    expect(reviewQuestion(q(), withSlot(ctx(), { ...slot, section: "GA" })).checks.blueprint).toBe(false);
    expect(reviewQuestion(q(), withSlot(ctx(), { ...slot, q: 2 })).checks.blueprint).toBe(false);
    expect(reviewQuestion(q(), withSlot(ctx(), { ...slot, subjectId: "la", topicId: "la-vector-spaces" })).status).toBe("NEEDS_REVIEW");
  });
  it("broken math, unbalanced $ and placeholder text are caught", () => {
    expect(reviewQuestion(q({ stem: "Compute $\\frac{1}{ for the sample." }), ctx()).checks.formatting).toBe(false);
    expect(reviewQuestion(q({ stem: "The mean is $5 and the variance is 4. Find n." }), ctx()).checks.formatting).toBe(false);
    expect(reviewQuestion(q({ stem: "The price is \\$5 per unit; how many units fit a budget of \\$105?" }), ctx()).checks.formatting).toBe(true);
    const r = reviewQuestion(q({ solution: { quick: "TODO", steps: [{ title: "a", body: "b" }, { title: "c", body: "d" }], finalAnswer: "105" } }), ctx());
    expect(r.checks.noPlaceholders).toBe(false);
    expect(r.status).toBe("NEEDS_REVIEW");
  });
  it("answers leaked in the stem or options are caught, as are duplicate options", () => {
    expect(reviewQuestion(q({ stem: q().stem + " (The answer is 105.)" }), ctx()).checks.noAnswerLeak).toBe(false);
    const m = mcq();
    const leaky = m.options.map((o) => (o.label === "B" ? { ...o, text: o.text + " (correct)" } : o));
    expect(reviewQuestion(mcq({ options: leaky }), withSlot(ctx(), mcqSlot)).checks.noAnswerLeak).toBe(false);
    const dupOpts = m.options.map((o) => (o.label === "D" ? { ...o, text: m.options[0].text } : o));
    expect(reviewQuestion(mcq({ options: dupOpts }), withSlot(ctx(), mcqSlot)).status).toBe("NEEDS_REVIEW");
  });
});

