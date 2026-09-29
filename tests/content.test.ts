/**
 * Integration test over the REAL content: compiles content/ exactly as the
 * build does and checks the integrity invariants the platform promises.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { compileContent } from "@/lib/content/compile";
import { parseOfficialKey, answersEqual } from "@/lib/content/validate";
import type { ContentBundle } from "@/lib/content/types";
import { loadRawContent } from "../scripts/content/build";

const ROOT = path.resolve(__dirname, "..");
let bundle: ContentBundle;
let issues: { level: string; entity: string; message: string }[];

beforeAll(() => {
  const r = compileContent(loadRawContent(), { figureExists: (p) => fs.existsSync(path.join(ROOT, "public", p)) });
  bundle = r.bundle;
  issues = r.issues;
}, 120_000);

describe("content integrity", () => {
  it("has no validation errors other than not-yet-generated mock questions", () => {
    const errors = issues.filter((i) => i.level === "error" && !/question\(s\) missing/.test(i.message));
    expect(errors).toEqual([]);
  });

  it("every PYQ answer equals the official answer-key table parsed from the key PDF", () => {
    const keys = JSON.parse(fs.readFileSync(path.join(ROOT, "content/exam/official-keys.json"), "utf8")) as { paperId: string; rows: { q: number; key: string; type: "MCQ" | "MSQ" | "NAT"; marks: number }[] }[];
    const map = new Map<string, (typeof keys)[number]["rows"][number]>(keys.flatMap((t) => t.rows.map((r) => [`${t.paperId}#${r.q}`, r] as const)));
    const pyqs = bundle.questions.filter((q) => q.origin === "OFFICIAL_PYQ");
    expect(pyqs.length).toBeGreaterThan(0);
    for (const q of pyqs) {
      const row = map.get(`${q.paperId}#${q.questionNumber}`)!;
      expect(row, q.id).toBeTruthy();
      expect(answersEqual(parseOfficialKey(row.key, row.type)!, q.answer), q.id).toBe(true);
      expect(q.marks, q.id).toBe(row.marks);
      expect(q.type, q.id).toBe(row.type);
    }
  });

  it("official keys describe three 65-question, 100-mark DA papers", () => {
    expect(bundle.papers.map((p) => p.year).sort()).toEqual([2024, 2025, 2026]);
    for (const p of bundle.papers) {
      expect(p.totalQuestions).toBe(65);
      expect(p.totalMarks).toBe(100);
      expect(["FORENOON", "AFTERNOON"]).toContain(p.slot);
    }
  });

  it("every question has an origin, a solution and an answer", () => {
    for (const q of bundle.questions) {
      expect(["OFFICIAL_PYQ", "ORIGINAL_PRACTICE", "MOCK_TEST"]).toContain(q.origin);
      expect(q.html.steps.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.html.finalAnswer.length, q.id).toBeGreaterThan(0);
      expect(q.answer, q.id).toBeTruthy();
    }
  });

  it("original questions never claim to be official", () => {
    for (const q of bundle.questions.filter((x) => x.origin !== "OFFICIAL_PYQ")) {
      expect(q.sourceIds).toEqual(["platform-original"]);
      expect(q.paperId).toBeUndefined();
      expect(q.year).toBeUndefined();
    }
  });

  it("defines exactly 50 mock tests with the official structure for full simulations", () => {
    expect(bundle.mocks).toHaveLength(50);
    expect(bundle.mocks.map((m) => m.number)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    for (const m of bundle.mocks.filter((x) => x.tier === "FULL_GATE")) expect(m.questionIds).toHaveLength(65);
  });

  it("every official syllabus subtopic is implemented", () => {
    const n = bundle.syllabus.subjects.reduce((a, s) => a + s.topics.reduce((b, t) => b + t.subtopics.length, 0), 0);
    expect(n).toBe(111);
    expect(bundle.syllabus.subjects.map((s) => s.id).sort()).toEqual(["ai", "co", "dbw", "ga", "la", "ml", "pdsa", "ps"]);
  });

  it("all source references resolve and every official source has a status and notes", () => {
    for (const s of bundle.sources) {
      expect(["VERIFIED", "PARTIALLY_VERIFIED", "NEEDS_REVIEW"]).toContain(s.verificationStatus);
      expect(s.verificationNotes.length).toBeGreaterThan(20);
    }
  });

  it("weightage marks per paper equal the loaded questions' marks", () => {
    for (const p of bundle.papers) {
      const w = bundle.weightage.byPaper[p.id];
      const loaded = bundle.questions.filter((q) => q.paperId === p.id).reduce((a, q) => a + q.marks, 0);
      expect(w.totalMarks).toBe(loaded);
    }
  });
});
