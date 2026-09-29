/**
 * PYQ dataset audit (runs on the real content): completeness, integrity,
 * chronological organisation, filtering, and the freeze guard.
 */
import { beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compileContent } from "@/lib/content/compile";
import type { ContentBundle, CompiledQuestion, QuestionMeta } from "@/lib/content/types";
import { buildGroupLookups, buildResults, DEFAULT_FILTERS, parseSearch, rowMatches, type BrowseFilters, type RowFacts } from "@/components/pyq/filters";
import { toPaperInfo, toTaxonomy } from "@/components/pyq/data";
import { loadRawContent } from "../scripts/content/build";

const ROOT = path.resolve(__dirname, "..");
let bundle: ContentBundle;
let pyqs: CompiledQuestion[];

beforeAll(() => {
  bundle = compileContent(loadRawContent(), { figureExists: (p) => fs.existsSync(path.join(ROOT, "public", p)) }).bundle;
  pyqs = bundle.questions.filter((q) => q.origin === "OFFICIAL_PYQ");
}, 120_000);

const meta = (q: CompiledQuestion): QuestionMeta => q;
const facts: RowFacts = { state: "unattempted" as RowFacts["state"], bookmarked: false, haystack: "" };
const filterBy = (f: Partial<BrowseFilters>) =>
  pyqs.filter((q) => rowMatches(meta(q), { ...DEFAULT_FILTERS, ...f }, parseSearch(f.q ?? ""), { ...facts, haystack: `${q.preview} ${q.topicId}`.toLowerCase() }));

describe("PYQ dataset completeness & integrity", () => {
  it("has no duplicate ids and no duplicate question text", () => {
    expect(new Set(pyqs.map((q) => q.id)).size).toBe(pyqs.length);
    expect(new Set(pyqs.map((q) => q.fingerprint)).size).toBe(pyqs.length);
  });
  it("every question carries subject, topic, type, marks, answer, solution, source and statuses", () => {
    for (const q of pyqs) {
      expect(q.subjectId && q.topicId && q.type && q.marks, q.id).toBeTruthy();
      expect(q.answer, q.id).toBeTruthy();
      expect(q.html.steps.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.sourceIds.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.transcription?.status, q.id).toBeTruthy();
      expect(q.answerVerification.status, q.id).toBeTruthy();
      expect(q.solutionStatus, q.id).toBeTruthy();
      expect(q.examDate && q.session && q.slot && q.questionNumber, q.id).toBeTruthy();
    }
  });
  it("each loaded paper keeps its official numbering, session and slot", () => {
    for (const p of bundle.papers) {
      const qs = pyqs.filter((q) => q.paperId === p.id);
      expect(new Set(qs.map((q) => q.questionNumber)).size).toBe(qs.length);
      for (const q of qs) {
        expect(q.session).toBe(p.session);
        expect(q.slot).toBe(p.slot);
        expect(q.examDate).toBe(p.examDate);
        expect(q.section).toBe(q.questionNumber! <= 10 ? "GA" : "DA");
      }
    }
  });
  it("disputed questions keep the official key and are flagged NEEDS_REVIEW with an explanation", () => {
    for (const q of pyqs.filter((x) => !x.answerVerification.agreesWithKey)) {
      expect(q.answerVerification.status, q.id).toBe("NEEDS_REVIEW");
      expect(q.verification, q.id).toBe("NEEDS_REVIEW");
      expect(q.answerVerification.notes.length, q.id).toBeGreaterThan(50);
    }
  });
});

describe("PYQ organisation & filtering (the same pure functions the browser uses)", () => {
  it("sorts newest → oldest by default and oldest → newest on request", () => {
    const taxonomy = toTaxonomy(bundle.syllabus.subjects);
    const papers = bundle.papers.map(toPaperInfo);
    const look = buildGroupLookups(taxonomy, papers);
    const newest = buildResults(pyqs.map(meta), "newest", look).orderedIds.map((id) => pyqs.find((q) => q.id === id)!);
    const years = newest.map((q) => q.year!);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
    const oldest = buildResults(pyqs.map(meta), "oldest", look).orderedIds.map((id) => pyqs.find((q) => q.id === id)!);
    expect(oldest[0].year).toBe(Math.min(...years));
    // within a paper, official question order
    const first = newest.filter((q) => q.paperId === newest[0].paperId).map((q) => q.questionNumber!);
    expect([...first].sort((a, b) => a - b)).toEqual(first);
  });
  it("filters by subject, topic, year, type, marks and question number", () => {
    const ml = filterBy({ subject: "ml" });
    expect(ml.length).toBeGreaterThan(0);
    expect(ml.every((q) => q.subjectId === "ml")).toBe(true);
    const topic = ml[0].topicId;
    expect(filterBy({ subject: "ml", topic }).every((q) => q.topicId === topic)).toBe(true);
    expect(filterBy({ year: "2026" }).every((q) => q.year === 2026)).toBe(true);
    expect(filterBy({ type: "NAT", marks: "2" }).every((q) => q.type === "NAT" && q.marks === 2)).toBe(true);
    const q36 = filterBy({ year: "2026", q: "Q36" });
    expect(q36.map((q) => q.id)).toEqual(["DA2026-S8-Q36"]);
  });
  it("GA questions are exactly Q1–Q10 of each paper", () => {
    const ga = filterBy({ subject: "ga" });
    expect(ga.every((q) => q.questionNumber! <= 10)).toBe(true);
    for (const p of bundle.papers) {
      const n = pyqs.filter((q) => q.paperId === p.id).length;
      if (n === 65) expect(ga.filter((q) => q.paperId === p.id)).toHaveLength(10);
    }
  });
});

const freezePath = path.join(ROOT, "content/exam/pyq-freeze.json");
describe.runIf(fs.existsSync(freezePath))("PYQ freeze guard", () => {
  it("no frozen PYQ file has changed (re-run npm run content:freeze-pyqs only for intended corrections)", () => {
    const freeze = JSON.parse(fs.readFileSync(freezePath, "utf8")) as { files: Record<string, string> };
    const changed: string[] = [];
    for (const [rel, hash] of Object.entries(freeze.files)) {
      const f = path.join(ROOT, "content/pyqs", rel);
      const now = fs.existsSync(f) ? crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") : "missing";
      if (now !== hash) changed.push(rel);
    }
    expect(changed).toEqual([]);
  });
});
