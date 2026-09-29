import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Syllabus } from "@/lib/content/schema";
import { answersEqual, buildTaxonomyIndex, findDuplicates, fingerprint, normalizeText, parseOfficialKey, shingleSimilarity, validateQuestionSemantics } from "@/lib/content/validate";

const syllabus = Syllabus.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "../content/syllabus.json"), "utf8")));
const tax = buildTaxonomyIndex(syllabus);

function pyq(over: Record<string, unknown> = {}) {
  return {
    id: "DA2026-S8-Q36",
    origin: "OFFICIAL_PYQ" as const,
    paperId: "DA-2026-S8",
    year: 2026,
    questionNumber: 36,
    section: "DA" as const,
    subjectId: "ml" as const,
    topicId: "ml-clustering",
    subtopicIds: ["ml-hierarchical"],
    type: "MCQ" as const,
    marks: 2,
    difficulty: "EASY" as const,
    difficultyRationale: "Platform-estimated: one concept.",
    stem: "Which pair merges first?",
    options: ["A", "B", "C", "D"].map((l) => ({ label: l as "A", text: `opt ${l}` })),
    answer: { kind: "MCQ" as const, correct: "D" as const },
    officialKeyRaw: "D",
    solution: {
      quick: "q",
      steps: [
        { title: "a", body: "b" },
        { title: "c", body: "d" },
      ],
      finalAnswer: "**(D)**",
      optionAnalysis: ["A", "B", "C", "D"].map((l) => ({ label: l as "A", verdict: (l === "D" ? "correct" : "incorrect") as "correct", explanation: "x" })),
    },
    conceptIds: [],
    formulaIds: [],
    estimatedTimeSec: 60,
    officialImages: [],
    sourceIds: ["gate2026-da-qp", "gate2026-da-key"],
    transcription: { status: "VERIFIED" as const, notes: "" },
    answerVerification: { status: "VERIFIED" as const, method: "blind", agreesWithKey: true, notes: "" },
    solutionStatus: "VERIFIED" as const,
    ...over,
  };
}

describe("official key parsing", () => {
  it("parses MCQ, MSQ, NAT ranges and MTA", () => {
    expect(parseOfficialKey("B", "MCQ")).toEqual({ kind: "MCQ", correct: "B" });
    expect(parseOfficialKey("C;A", "MSQ")).toEqual({ kind: "MSQ", correct: ["A", "C"] });
    expect(parseOfficialKey("0.062 to 0.063", "NAT")).toEqual({ kind: "NAT", min: 0.062, max: 0.063 });
    expect(parseOfficialKey("8  to 8", "NAT")).toEqual({ kind: "NAT", min: 8, max: 8 });
    expect(parseOfficialKey("MTA", "NAT")).toMatchObject({ kind: "MTA" });
    expect(parseOfficialKey("A;B", "MCQ")).toBeNull();
    expect(parseOfficialKey("E", "MCQ")).toBeNull();
  });
  it("compares answers", () => {
    expect(answersEqual({ kind: "MSQ", correct: ["C", "A"] }, { kind: "MSQ", correct: ["A", "C"] })).toBe(true);
    expect(answersEqual({ kind: "NAT", min: 1, max: 2 }, { kind: "NAT", min: 1, max: 3 })).toBe(false);
  });
});

describe("question semantic validation", () => {
  it("accepts a consistent PYQ", () => {
    expect(validateQuestionSemantics(pyq(), tax).filter((i) => i.level === "error")).toEqual([]);
  });
  it("flags an answer that differs from the official key", () => {
    const errs = validateQuestionSemantics(pyq({ officialKeyRaw: "A" }), tax).map((i) => i.message);
    expect(errs.some((m) => /official key/.test(m))).toBe(true);
  });
  it("flags subject/topic mismatch and unknown subtopics", () => {
    const errs = validateQuestionSemantics(pyq({ topicId: "ps-inference" }), tax).map((i) => i.message);
    expect(errs.some((m) => /belongs to ps/.test(m))).toBe(true);
    const errs2 = validateQuestionSemantics(pyq({ subtopicIds: ["nope"] }), tax).map((i) => i.message);
    expect(errs2.some((m) => /unknown subtopicId/.test(m))).toBe(true);
  });
  it("flags inconsistent marks and GA section rules", () => {
    expect(validateQuestionSemantics(pyq({ marks: 1 }), tax).some((i) => /should carry 2/.test(i.message))).toBe(true);
    expect(validateQuestionSemantics(pyq({ questionNumber: 3, id: "DA2026-S8-Q03" }), tax).some((i) => /section GA/.test(i.message))).toBe(true);
  });
  it("flags invalid question types / options / NAT ranges", () => {
    const nat = pyq({ type: "NAT", answer: { kind: "NAT", min: 3, max: 2 }, officialKeyRaw: "3 to 2" });
    const msgs = validateQuestionSemantics(nat, tax).map((i) => i.message);
    expect(msgs.some((m) => /must not have options/.test(m))).toBe(true);
    expect(msgs.some((m) => /NAT range invalid/.test(m))).toBe(true);
  });
  it("flags VERIFIED answers that disagree with the key", () => {
    const q = pyq({ answerVerification: { status: "VERIFIED", method: "x", agreesWithKey: false, notes: "" } });
    expect(validateQuestionSemantics(q, tax).some((i) => /VERIFIED but/.test(i.message))).toBe(true);
  });
  it("flags missing figures", () => {
    const q = pyq({ stem: "See ![Figure: tree](/pyq/2026/fig/missing.png)" });
    expect(validateQuestionSemantics(q, tax, { figureExists: () => false }).some((i) => /figure not found/.test(i.message))).toBe(true);
  });
});

describe("duplicate detection", () => {
  it("normalises and fingerprints text", () => {
    expect(normalizeText("The  VALUE of $\\frac{1}{2}$ is?")).toBe("the value of 1 2 is");
    expect(fingerprint("A  b")).toBe(fingerprint("a b"));
  });
  it("detects exact and near duplicates but not distinct questions", () => {
    const items = [
      { id: "x", text: "A fair coin is tossed three times. Find the probability of exactly two heads." },
      { id: "y", text: "A fair coin is tossed three times.  Find the probability of exactly two heads!" },
      { id: "z", text: "A fair coin is tossed three times. Find the probability of exactly two heads in total." },
      { id: "w", text: "Compute the rank of the given 3x3 matrix over the reals." },
    ];
    const d = findDuplicates(items, 0.7);
    expect(d.find((x) => x.a === "x" && x.b === "y")?.kind).toBe("exact");
    expect(d.some((x) => x.b === "z" && x.kind === "near")).toBe(true);
    expect(d.some((x) => x.a === "w" || x.b === "w")).toBe(false);
    expect(shingleSimilarity("a b c d", "a b c d")).toBe(1);
  });
});
