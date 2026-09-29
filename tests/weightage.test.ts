import { describe, expect, it } from "vitest";
import { computeWeightage, variationLabel, confidenceNote } from "@/lib/weightage/compute";

const papers = [
  { id: "DA-2024-S1", year: 2024, examDate: "2024-02-03", session: 1 },
  { id: "DA-2025-S5", year: 2025, examDate: "2025-02-15", session: 5 },
];
const q = (id: string, paperId: string, subjectId: string, marks: number, topicId = `${subjectId}-t`) => ({ id, paperId, year: Number(paperId.slice(3, 7)), subjectId, topicId, type: "MCQ" as const, marks });
const questions = [q("1", "DA-2024-S1", "ml", 2), q("2", "DA-2024-S1", "ml", 1), q("3", "DA-2024-S1", "ps", 2), q("4", "DA-2025-S5", "ml", 1), q("5", "DA-2025-S5", "ps", 2), q("6", "DA-2025-S5", "ps", 2)];

describe("historical weightage", () => {
  const w = computeWeightage(questions, papers, ["ml", "ps", "ai"]);
  it("computes per-paper marks and ranges without pooling papers", () => {
    const ml = w.subjects.find((s) => s.subjectId === "ml")!;
    expect(ml.perPaper.map((p) => p.marks)).toEqual([3, 1]);
    expect([ml.marksMin, ml.marksMax, ml.marksMean]).toEqual([1, 3, 2]);
    expect([ml.questionsMin, ml.questionsMax]).toEqual([1, 2]);
    expect(ml.papersAppeared).toBe(2);
  });
  it("labels variation from the coefficient of variation", () => {
    const ml = w.subjects.find((s) => s.subjectId === "ml")!;
    expect(ml.marksCv).toBeCloseTo(0.5, 3);
    expect(ml.variation).toBe("High");
    const ai = w.subjects.find((s) => s.subjectId === "ai")!;
    expect(ai.papersAppeared).toBe(0);
    expect(ai.variation).toBe("Insufficient data");
  });
  it("computes shares and topic frequencies", () => {
    expect(w.totalMarks).toBe(10);
    expect(w.subjects.find((s) => s.subjectId === "ps")!.shareOfMarks).toBeCloseTo(0.6);
    expect(w.topics[0]).toMatchObject({ topicId: "ps-t", marks: 6, questions: 3, papersAppeared: 2 });
  });
  it("filters to selected papers", () => {
    const one = computeWeightage(questions, papers, ["ml", "ps"], { paperIds: ["DA-2025-S5"] });
    expect(one.papers).toHaveLength(1);
    expect(one.subjects.find((s) => s.subjectId === "ml")!.variation).toBe("Insufficient data");
    expect(one.confidenceNote).toMatch(/single paper/);
  });
  it("labels thresholds", () => {
    expect(variationLabel(0.1, 3)).toBe("Low");
    expect(variationLabel(0.3, 3)).toBe("Medium");
    expect(variationLabel(0.5, 3)).toBe("High");
    expect(variationLabel(0.1, 1)).toBe("Insufficient data");
    expect(confidenceNote(3)).toMatch(/3 papers/);
  });
});
