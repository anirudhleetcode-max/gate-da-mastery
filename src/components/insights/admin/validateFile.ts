/**
 * Validate the text of one content file before the admin editor writes it:
 * JSON syntax → the Zod schema chosen by path (the same schemas the content
 * build uses) → semantic checks (validateQuestionSemantics, taxonomy,
 * official-key agreement, KaTeX rendering, duplicate ids).
 *
 * Server-only (reads the syllabus and official-key table from disk).
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  Concept,
  ExamPaper,
  ExamPattern,
  Formula,
  MockTest,
  OriginalQuestion,
  Pyq,
  RoadmapStage,
  Source,
  StrategyArticle,
  Syllabus,
} from "@/lib/content/schema";
import { buildTaxonomyIndex, validateQuestionSemantics, type Issue, type TaxonomyIndex } from "@/lib/content/validate";
import { renderDisplayMath, renderMarkdown } from "@/lib/content/markdown";

export type FileKind =
  | "pyq"
  | "mock-questions"
  | "practice-questions"
  | "concepts"
  | "formulas"
  | "strategy"
  | "roadmap"
  | "sources"
  | "syllabus"
  | "papers"
  | "pattern"
  | "mock-tests"
  | "blueprint"
  | "official-keys"
  | "pyq-freeze"
  | "unknown";

export interface FileKindInfo {
  kind: FileKind;
  label: string;
  /** false: the editor shows the file read-only and the API refuses writes. */
  writable: boolean;
  /** Why the file is read-only (when it is). */
  readOnlyReason?: string;
  /** Official PYQs are frozen: a write needs a freeze reason and a re-freeze afterwards. */
  frozen: boolean;
  /** Commands to run after a successful save. */
  reminders: string[];
}

const BUILD = "npm run content:build";

export function fileKind(rel: string): FileKindInfo {
  const base = { writable: true, frozen: false };
  const build = `Run \`${BUILD}\` to recompile generated/content.json, then restart the server (it loads the bundle once per process).`;
  if (/^content\/pyqs\/\d{4}\/[^/]+\.json$/.test(rel)) {
    return {
      ...base,
      kind: "pyq",
      label: "Official PYQ (frozen)",
      frozen: true,
      reminders: [
        'Run `npm run content:freeze-pyqs -- --reason "<the same reason>"` to record the change in the PYQ freeze log (tests/pyq-dataset.test.ts fails until you do).',
        build,
      ],
    };
  }
  const mockMatch = rel.match(/^content\/mocks\/questions\/(mock-\d{2})[^/]*\.json$/);
  if (mockMatch) {
    return {
      ...base,
      kind: "mock-questions",
      label: "Mock-test questions",
      reminders: [
        `Run \`npm run content:mock-review -- --tests ${mockMatch[1]}\` to re-run the deterministic review gates. An edited VERIFIED question drops to NEEDS_REVIEW until it is independently re-verified.`,
        build,
      ],
    };
  }
  if (/^content\/practice\/[^/]+\.json$/.test(rel)) {
    return {
      ...base,
      kind: "practice-questions",
      label: "Original practice questions",
      reminders: ["Run `npm run content:mock-review` to re-run the review gates for practice questions (only VERIFIED practice questions are shown to students).", build],
    };
  }
  if (/^content\/concepts\/[^/]+\.json$/.test(rel)) return { ...base, kind: "concepts", label: "Concept library", reminders: [build] };
  if (/^content\/formulas\/[^/]+\.json$/.test(rel)) return { ...base, kind: "formulas", label: "Formula book", reminders: [build] };
  if (rel === "content/strategy/articles.json") return { ...base, kind: "strategy", label: "Strategy articles", reminders: [build] };
  if (rel === "content/roadmap.json") return { ...base, kind: "roadmap", label: "Study roadmap", reminders: [build] };
  if (rel === "content/sources.json") return { ...base, kind: "sources", label: "Source registry", reminders: [build, "If you changed a URL or hash, run `npm run sources:verify` from a network that can reach the official host."] };
  if (rel === "content/syllabus.json") return { ...base, kind: "syllabus", label: "Syllabus and taxonomy", reminders: [build, "Run `npm test` — renamed topic or subtopic ids break questions that reference them."] };
  if (rel === "content/exam/papers.json") return { ...base, kind: "papers", label: "Exam papers", reminders: [build] };
  if (rel === "content/exam/pattern.json") return { ...base, kind: "pattern", label: "Exam pattern facts", reminders: [build] };
  if (rel === "content/mocks/tests.json") return { ...base, kind: "mock-tests", label: "Mock-test definitions", reminders: [build] };
  if (rel === "content/mocks/blueprint.json") return { ...base, kind: "blueprint", label: "Mock blueprint", reminders: ["Run `npm run content:mock-review` — blueprint conformance is one of the review gates.", build] };
  if (rel === "content/exam/official-keys.json") {
    return {
      kind: "official-keys",
      label: "Official answer-key table",
      writable: false,
      frozen: false,
      readOnlyReason: "This table is parsed programmatically from the official answer-key PDFs and is the independent cross-check for every PYQ answer. Re-parse the PDFs instead of editing it by hand.",
      reminders: [],
    };
  }
  if (rel === "content/exam/pyq-freeze.json") {
    return {
      kind: "pyq-freeze",
      label: "PYQ freeze manifest",
      writable: false,
      frozen: false,
      readOnlyReason: "Written only by `npm run content:freeze-pyqs -- --reason \"…\"`, which records every re-freeze in its log.",
      reminders: [],
    };
  }
  return { kind: "unknown", label: "Content file", writable: false, frozen: false, readOnlyReason: "There is no validator for this path, so it cannot be saved from the browser. Edit it in your editor and run `npm run content:validate`.", reminders: [] };
}

// ------------------------------------------------------------------ helpers

const OfficialKeyTable = z.array(
  z.object({
    paperId: z.string(),
    sourceId: z.string(),
    note: z.string(),
    rows: z.array(z.object({ q: z.number(), session: z.number(), type: z.enum(["MCQ", "MSQ", "NAT"]), section: z.enum(["GA", "DA"]), key: z.string(), marks: z.number() })),
  }),
);

const Blueprint = z.record(
  z.string(),
  z.object({
    tier: z.string(),
    slots: z.array(
      z.object({
        q: z.number().int().positive(),
        section: z.enum(["GA", "DA"]),
        subjectId: z.string(),
        topicId: z.string(),
        subtopicId: z.string(),
        type: z.enum(["MCQ", "MSQ", "NAT"]),
        marks: z.number(),
        difficulty: z.enum(["EASY", "MODERATE", "HARD", "VERY_HARD"]),
      }),
    ),
  }),
);

function readJson(projectRoot: string, rel: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, rel), "utf8"));
  } catch {
    return null;
  }
}

function taxonomy(projectRoot: string): TaxonomyIndex | null {
  const s = Syllabus.safeParse(readJson(projectRoot, "content/syllabus.json"));
  return s.success ? buildTaxonomyIndex(s.data) : null;
}

/** Human-readable position for a JSON.parse error ("line 12, column 5"). */
export function jsonErrorMessage(text: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/position (\d+)/);
  if (!m) return msg;
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split("\n").length;
  const col = pos - before.lastIndexOf("\n");
  return `${msg.replace(/\s*\(line \d+ column \d+\)/, "")} (line ${line}, column ${col})`;
}

function zodIssues(e: z.ZodError, entity: string): Issue[] {
  return e.issues.slice(0, 50).map((i) => ({ level: "error" as const, entity, message: `${i.path.join(".") || "(root)"}: ${i.message}` }));
}

function duplicateIds(items: { id: string }[], entity: string): Issue[] {
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const x of items) {
    if (seen.has(x.id)) out.push({ level: "error", entity, message: `duplicate id ${x.id}` });
    seen.add(x.id);
  }
  return out;
}

type QuestionLike = z.infer<typeof Pyq> | z.infer<typeof OriginalQuestion>;

/** Render every Markdown field of a question: KaTeX / Markdown errors fail the build, so they fail here too. */
function markdownIssues(q: QuestionLike): Issue[] {
  const s = q.solution;
  const fields: [string, string | undefined][] = [
    ["stem", q.stem],
    ...q.options.map((o) => [`option ${o.label}`, o.text] as [string, string]),
    ["solution.quick", s.quick],
    ...s.steps.map((st, i) => [`step ${i + 1}`, st.body] as [string, string]),
    ["solution.finalAnswer", s.finalAnswer],
    ["solution.teaching", s.teaching],
    ...(s.optionAnalysis ?? []).map((o) => [`optionAnalysis ${o.label}`, o.explanation] as [string, string]),
    ["solution.shortcut", s.shortcut],
    ["solution.commonTrap", s.commonTrap],
  ];
  const out: Issue[] = [];
  for (const [label, md] of fields) {
    if (!md) continue;
    for (const e of renderMarkdown(md).errors) out.push({ level: "error", entity: q.id, message: `${label}: ${e}` });
  }
  return out;
}

// ------------------------------------------------------------------ main

export interface FileValidation {
  info: FileKindInfo;
  issues: Issue[];
  /** Number of records checked (questions, sources, …), when meaningful. */
  records?: number;
}

export function validateContentFile(rel: string, text: string, projectRoot: string = process.cwd()): FileValidation {
  const info = fileKind(rel);
  const issues: Issue[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { info, issues: [{ level: "error", entity: rel, message: `Invalid JSON: ${jsonErrorMessage(text, e)}` }] };
  }
  const figureExists = (p: string) => p.startsWith("/") && !p.includes("..") && fs.existsSync(path.join(projectRoot, "public", p));
  const needTax = (): TaxonomyIndex | null => {
    const t = taxonomy(projectRoot);
    if (!t) issues.push({ level: "error", entity: "content/syllabus.json", message: "The syllabus could not be read, so taxonomy checks were skipped." });
    return t;
  };

  switch (info.kind) {
    case "pyq": {
      const r = Pyq.safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      const q = r.data;
      const tax = needTax();
      if (tax) issues.push(...validateQuestionSemantics(q, tax, { figureExists }));
      issues.push(...markdownIssues(q));
      if (path.posix.basename(rel) !== `${q.id}.json`) issues.push({ level: "error", entity: rel, message: `file must be named ${q.id}.json` });
      if (!rel.startsWith(`content/pyqs/${q.year}/`)) issues.push({ level: "error", entity: rel, message: `file must be in content/pyqs/${q.year}/` });
      // Independent cross-check against the machine-parsed official key table.
      const keys = OfficialKeyTable.safeParse(readJson(projectRoot, "content/exam/official-keys.json"));
      if (keys.success) {
        const row = keys.data.find((t) => t.paperId === q.paperId)?.rows.find((x) => x.q === q.questionNumber);
        if (!row) issues.push({ level: "error", entity: q.id, message: "no row in the official answer-key table" });
        else {
          const norm = (s: string) => s.replace(/\s+/g, " ").trim();
          if (norm(row.key) !== norm(q.officialKeyRaw)) issues.push({ level: "error", entity: q.id, message: `officialKeyRaw "${q.officialKeyRaw}" differs from the official key table ("${row.key}")` });
          if (row.type !== q.type) issues.push({ level: "error", entity: q.id, message: `type ${q.type} differs from the official key (${row.type})` });
          if (row.marks !== q.marks) issues.push({ level: "error", entity: q.id, message: `marks ${q.marks} differ from the official key (${row.marks})` });
          if (row.section !== q.section) issues.push({ level: "error", entity: q.id, message: `section ${q.section} differs from the official key (${row.section})` });
        }
      }
      return { info, issues, records: 1 };
    }
    case "mock-questions":
    case "practice-questions": {
      const r = z.array(OriginalQuestion).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      const tax = needTax();
      const expectedOrigin = info.kind === "mock-questions" ? "MOCK_TEST" : "ORIGINAL_PRACTICE";
      const testPrefix = rel.match(/(mock-\d{2})/)?.[1];
      for (const q of r.data) {
        if (tax) issues.push(...validateQuestionSemantics(q, tax, { figureExists }));
        issues.push(...markdownIssues(q));
        if (q.origin !== expectedOrigin) issues.push({ level: "error", entity: q.id, message: `origin must be ${expectedOrigin} in this file` });
        if (info.kind === "mock-questions" && testPrefix && q.testId !== testPrefix) issues.push({ level: "error", entity: q.id, message: `testId ${q.testId ?? "(missing)"} does not match file ${testPrefix}` });
      }
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "concepts": {
      const r = z.array(Concept).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      const tax = needTax();
      for (const c of r.data) {
        if (tax && tax.topics.get(c.topicId) !== c.subjectId) issues.push({ level: "error", entity: c.id, message: `topic ${c.topicId} is not in subject ${c.subjectId}` });
        if (tax) for (const st of c.subtopicIds) if (!tax.subtopics.has(st)) issues.push({ level: "error", entity: c.id, message: `unknown subtopic ${st}` });
        for (const [label, md] of [["definition", c.definition], ["intuition", c.intuition], ["math", c.math], ["example", c.example], ["gateRelevance", c.gateRelevance], ...c.commonMistakes.map((m, i) => [`commonMistakes[${i}]`, m])] as [string, string][]) {
          for (const e of renderMarkdown(md).errors) issues.push({ level: "error", entity: c.id, message: `${label}: ${e}` });
        }
      }
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "formulas": {
      const r = z.array(Formula).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      const tax = needTax();
      for (const f of r.data) {
        if (tax && tax.topics.get(f.topicId) !== f.subjectId) issues.push({ level: "error", entity: f.id, message: `topic ${f.topicId} is not in subject ${f.subjectId}` });
        for (const e of renderDisplayMath(f.latex).errors) issues.push({ level: "error", entity: f.id, message: `latex: ${e}` });
        for (const [label, md] of [["meaning", f.meaning], ["whenToUse", f.whenToUse], ["commonMistake", f.commonMistake], ["example", f.example]] as [string, string][]) {
          for (const e of renderMarkdown(md).errors) issues.push({ level: "error", entity: f.id, message: `${label}: ${e}` });
        }
      }
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "strategy": {
      const r = z.array(StrategyArticle).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      for (const s of r.data) for (const e of renderMarkdown(s.body).errors) issues.push({ level: "error", entity: s.id, message: `body: ${e}` });
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "roadmap": {
      const r = z.array(RoadmapStage).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "sources": {
      const r = z.array(Source).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "syllabus": {
      const r = Syllabus.safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      const ids = r.data.subjects.flatMap((s) => [{ id: s.id }, ...s.topics.flatMap((t) => [{ id: t.id }, ...t.subtopics.map((st) => ({ id: st.id }))])]);
      issues.push(...duplicateIds(ids, rel));
      return { info, issues, records: r.data.subjects.length };
    }
    case "papers": {
      const r = z.array(ExamPaper).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "pattern": {
      const r = ExamPattern.safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      issues.push(...duplicateIds(r.data.facts, rel));
      return { info, issues, records: r.data.facts.length };
    }
    case "mock-tests": {
      const r = z.array(MockTest).safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      issues.push(...duplicateIds(r.data, rel));
      return { info, issues, records: r.data.length };
    }
    case "blueprint": {
      const r = Blueprint.safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      return { info, issues, records: Object.keys(r.data).length };
    }
    case "official-keys": {
      const r = OfficialKeyTable.safeParse(data);
      if (!r.success) return { info, issues: zodIssues(r.error, rel) };
      return { info, issues, records: r.data.length };
    }
    default:
      return { info, issues };
  }
}
