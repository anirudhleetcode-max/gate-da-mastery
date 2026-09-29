import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { OriginalQuestion, Syllabus } from "@/lib/content/schema";
import { buildTaxonomyIndex } from "@/lib/content/validate";
import { reviewQuestion, type BlueprintSlot } from "@/lib/content/review";

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
const ctx = (corpus: { id: string; text: string; official: boolean }[] = []) => ({ tax, slot, corpus, today: "2026-09-29" });

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
