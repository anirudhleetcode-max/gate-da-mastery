/**
 * PYQ dataset audit (runs on the real content): completeness, integrity,
 * chronological organisation, filtering, and the freeze guard.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { compileContent } from "@/lib/content/compile";
import type { ContentBundle, CompiledQuestion, QuestionMeta } from "@/lib/content/types";
import { buildFilterContext, buildGroupLookups, buildResults, DEFAULT_FILTERS, normalizeFilters, parseSearch, rowMatches, type BrowseFilters, type RowFacts } from "@/components/pyq/filters";
import { toPaperInfo, toTaxonomy } from "@/components/pyq/data";
import { loadRawContent } from "../scripts/content/build";
import { snapshot, type FreezeFile } from "../scripts/content/freeze-pyqs";

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
  it("unresolved disagreements are NEEDS_REVIEW; resolved disputes keep the official key and cite adjudication evidence", () => {
    for (const q of pyqs.filter((x) => !x.answerVerification.agreesWithKey)) {
      expect(q.answerVerification.status, q.id).toBe("NEEDS_REVIEW");
      expect(q.verification, q.id).toBe("NEEDS_REVIEW");
      expect(q.answerVerification.notes.length, q.id).toBeGreaterThan(50);
    }
    for (const q of pyqs.filter((x) => x.dispute)) {
      const d = q.dispute!;
      expect(d.status, q.id).toBe("RESOLVED");
      expect(q.answerVerification.method, q.id).toMatch(/adjudicat/i);
      expect(fs.existsSync(path.join(ROOT, d.evidencePath)), d.evidencePath).toBe(true);
      const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, d.evidencePath), "utf8")) as { decision: string };
      expect(evidence.decision, q.id).toBe(d.decision);
      // The platform never changes the official key when resolving a dispute.
      expect(q.officialKeyRaw).toBeTruthy();
    }
  });
  it("no official PYQ is left open in NEEDS_REVIEW", () => {
    expect(pyqs.filter((q) => q.verification === "NEEDS_REVIEW").map((q) => q.id)).toEqual([]);
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
  it("a syllabus phrase alone matches every PYQ tagged with it, across topics", () => {
    const taxonomy = toTaxonomy(bundle.syllabus.subjects);
    const ctx = buildFilterContext(taxonomy, bundle.papers.map(toPaperInfo));
    // Find a phrase that is tagged on at least one PYQ filed under a different topic.
    const parent = new Map(bundle.syllabus.subjects.flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((st) => [st.id, t.id] as const))));
    const cross = pyqs.flatMap((q) => q.subtopicIds.filter((st) => parent.get(st) !== q.topicId))[0];
    expect(cross).toBeTruthy();
    const f = normalizeFilters({ ...DEFAULT_FILTERS, subtopic: cross }, ctx);
    expect(f.subtopic).toBe(cross);
    expect(f.topic).toBe("");
    const hits = filterBy(f);
    expect(hits.map((q) => q.id).sort()).toEqual(pyqs.filter((q) => q.subtopicIds.includes(cross)).map((q) => q.id).sort());
    expect(hits.some((q) => q.topicId !== parent.get(cross))).toBe(true);
    // With a different topic selected, the phrase is dropped.
    const other = bundle.syllabus.subjects.flatMap((s) => s.topics).find((t) => t.id !== parent.get(cross))!.id;
    expect(normalizeFilters({ ...DEFAULT_FILTERS, topic: other, subtopic: cross }, ctx).subtopic).toBe("");
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
  const freeze = JSON.parse(fs.readFileSync(freezePath, "utf8")) as FreezeFile;
  const live = snapshot();
  const frozen = Object.entries(freeze.files);

  it("the frozen set is complete: same count, same files, 65 per paper, no gaps", () => {
    expect(Object.keys(live).length).toBe(freeze.count);
    expect(Object.keys(live).sort()).toEqual(Object.keys(freeze.files).sort());
    for (const [paperId, n] of Object.entries(freeze.papers)) {
      const nums = Object.values(live).filter((e) => e.paperId === paperId).map((e) => e.questionNumber).sort((a, b) => a - b);
      expect(nums, paperId).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });
  it("ids are unique and match their file names", () => {
    const ids = Object.values(live).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [rel, e] of Object.entries(live)) expect(rel, e.id).toBe(`${e.year}/${e.id}.json`);
  });
  it("no frozen identity field drifted (id, paper, year, number, section, type, marks)", () => {
    const drift: string[] = [];
    for (const [rel, f] of frozen) {
      const l = live[rel];
      for (const k of ["id", "paperId", "year", "questionNumber", "section", "type", "marks"] as const) if (l?.[k] !== f[k]) drift.push(`${rel}.${k}`);
    }
    expect(drift).toEqual([]);
  });
  it("no frozen answer or official key cell changed, and answers still match the official key tables", () => {
    const drift = frozen.filter(([rel, f]) => live[rel]?.answer !== f.answer || live[rel]?.officialKeyRaw !== f.officialKeyRaw).map(([rel]) => rel);
    expect(drift).toEqual([]);
    const keys = JSON.parse(fs.readFileSync(path.join(ROOT, "content/exam/official-keys.json"), "utf8")) as { paperId: string; rows: { q: number; key: string }[] }[];
    for (const e of Object.values(live)) {
      const row = keys.find((k) => k.paperId === e.paperId)?.rows.find((r) => r.q === e.questionNumber);
      const norm = (s: string) => s.replace(/\s+/g, " ").trim();
      if (row) expect(norm(e.officialKeyRaw), e.id).toBe(norm(row.key));
    }
  });
  it("source metadata is unchanged and every cited source exists with a recorded hash", () => {
    const sources = JSON.parse(fs.readFileSync(path.join(ROOT, "content/sources.json"), "utf8")) as { id: string; sha256?: string }[];
    const byId = new Map(sources.map((s) => [s.id, s]));
    for (const [rel, f] of frozen) {
      expect(live[rel]?.sourceIds, rel).toEqual(f.sourceIds);
      for (const id of f.sourceIds) expect(byId.get(id)?.sha256, `${rel} → ${id}`).toBeTruthy();
    }
  });
  it("no frozen PYQ file changed byte-for-byte (re-freeze only with npm run content:freeze-pyqs -- --reason …)", () => {
    const changed = frozen.filter(([rel, f]) => live[rel]?.sha256 !== f.sha256).map(([rel]) => rel);
    expect(changed).toEqual([]);
  });
  it("every re-freeze is logged with a reason", () => {
    expect(freeze.log.length).toBeGreaterThan(0);
    for (const entry of freeze.log) expect(entry.reason.trim().length, entry.at).toBeGreaterThan(10);
  });
});
