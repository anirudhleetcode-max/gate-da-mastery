/**
 * Server-side readers for the verification artefacts shown on /sources:
 * the official answer-key table, the PYQ freeze manifest (+ its log) and the
 * audit reports. Every reader is tolerant: a missing or malformed file yields
 * null, and the page omits that section.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

function readJson(rel: string): unknown | null {
  try {
    // Read at build/render time from the checkout; not an output-tracing dependency.
    return JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

// ------------------------------------------------------------------ official keys

export interface KeyTableSummary {
  paperId: string;
  sourceId: string;
  note: string;
  rows: number;
  marks: number;
  mta: number;
}

export function loadOfficialKeys(): KeyTableSummary[] | null {
  const d = readJson("content/exam/official-keys.json");
  if (!Array.isArray(d)) return null;
  return d.filter(isObj).map((t) => {
    const rows = Array.isArray(t.rows) ? t.rows.filter(isObj) : [];
    return {
      paperId: str(t.paperId) ?? "?",
      sourceId: str(t.sourceId) ?? "",
      note: str(t.note) ?? "",
      rows: rows.length,
      marks: rows.reduce((a, r) => a + (num(r.marks) ?? 0), 0),
      mta: rows.filter((r) => str(r.key)?.toUpperCase() === "MTA").length,
    };
  });
}

// ------------------------------------------------------------------ PYQ freeze

export interface FreezeSummary {
  frozenAt: string;
  count: number;
  papers: Record<string, number>;
  log: { at: string; reason: string; changed: string[] }[];
}

export function loadFreeze(): FreezeSummary | null {
  const d = readJson("content/exam/pyq-freeze.json");
  if (!isObj(d)) return null;
  const papers: Record<string, number> = {};
  if (isObj(d.papers)) for (const [k, v] of Object.entries(d.papers)) if (num(v) !== undefined) papers[k] = v as number;
  const log = Array.isArray(d.log)
    ? d.log.filter(isObj).map((e) => ({ at: str(e.at) ?? "", reason: str(e.reason) ?? "", changed: Array.isArray(e.changed) ? e.changed.filter((x): x is string => typeof x === "string") : [] }))
    : [];
  return {
    frozenAt: str(d.frozenAt) ?? "",
    count: num(d.count) ?? (isObj(d.files) ? Object.keys(d.files).length : 0),
    papers,
    log: log.sort((a, b) => b.at.localeCompare(a.at)),
  };
}

// ------------------------------------------------------------------ reports

export interface ContentAuditSummary {
  generatedAt: string;
  publishable: boolean | null;
  errors: number | null;
  warnings: number | null;
  pyq: { total: number; verified: number; disagree: string[]; marksToAll: string[]; needsReview: number } | null;
  mocks: { tests: number; complete: number; questions: number; expected: number } | null;
  practice: { questions: number; verified: number } | null;
  learning: { concepts: number; formulas: number; strategy: number; roadmap: number } | null;
  sources: { total: number; byStatus: Record<string, number> } | null;
  duplicates: number | null;
}

export function loadContentAudit(): ContentAuditSummary | null {
  const d = readJson("reports/content-audit.json");
  if (!isObj(d) || !str(d.generatedAt)) return null;
  const p = isObj(d.pyqAudit) ? d.pyqAudit : null;
  const m = isObj(d.mockAudit) ? d.mockAudit : null;
  const pr = isObj(d.practiceAudit) ? d.practiceAudit : null;
  const l = isObj(d.learningAudit) ? d.learningAudit : null;
  const s = isObj(d.sourceAudit) ? d.sourceAudit : null;
  const v = isObj(d.validation) ? d.validation : null;
  const strings = (x: unknown) => (Array.isArray(x) ? x.map((y) => (typeof y === "string" ? y : isObj(y) ? (str(y.id) ?? "") : "")).filter(Boolean) : []);
  return {
    generatedAt: str(d.generatedAt)!,
    publishable: typeof d.publishable === "boolean" ? d.publishable : null,
    errors: v ? (num(v.errors) ?? null) : null,
    warnings: v ? (num(v.warnings) ?? null) : null,
    pyq: p
      ? {
          total: num(p.total) ?? 0,
          verified: num(p.verified) ?? 0,
          disagree: strings(p.disagreeWithOfficialKey),
          marksToAll: strings(p.marksToAll),
          needsReview: Array.isArray(p.needsReview) ? p.needsReview.length : 0,
        }
      : null,
    mocks: m ? { tests: num(m.tests) ?? 0, complete: num(m.complete) ?? 0, questions: num(m.questions) ?? 0, expected: num(m.questionsExpected) ?? 0 } : null,
    practice: pr ? { questions: num(pr.questions) ?? 0, verified: num(pr.verified) ?? 0 } : null,
    learning: l ? { concepts: num(l.concepts) ?? 0, formulas: num(l.formulas) ?? 0, strategy: num(l.strategyArticles) ?? 0, roadmap: num(l.roadmapStages) ?? 0 } : null,
    sources: s ? { total: num(s.total) ?? 0, byStatus: isObj(s.byStatus) ? (Object.fromEntries(Object.entries(s.byStatus).filter(([, x]) => num(x) !== undefined)) as Record<string, number>) : {} } : null,
    duplicates: Array.isArray(d.duplicates) ? d.duplicates.length : null,
  };
}

export interface MockVerificationSummary {
  generatedAt: string;
  testsComplete: number;
  plannedQuestions: number;
  drafted: number;
  verified: number;
  selfChecked: number;
  draft: number;
  needsReview: number;
  fixedDuringVerification: number;
  remaining: number;
  tests: { test: string; planned: number; present: number; verified: number; selfChecked: number; needsReview: number; fixed: number; complete: boolean }[];
}

export function loadMockVerification(): MockVerificationSummary | null {
  const d = readJson("reports/mock-verification.json");
  if (!isObj(d) || !isObj(d.summary) || !str(d.summary.generatedAt)) return null;
  const s = d.summary;
  const tests = Array.isArray(d.tests)
    ? d.tests.filter(isObj).map((t) => ({
        test: str(t.test) ?? "?",
        planned: num(t.planned) ?? 0,
        present: num(t.present) ?? 0,
        verified: num(t.verified) ?? 0,
        selfChecked: num(t.selfChecked) ?? 0,
        needsReview: num(t.needsReview) ?? 0,
        fixed: num(t.fixedDuringVerification) ?? 0,
        complete: t.complete === true,
      }))
    : [];
  return {
    generatedAt: str(s.generatedAt)!,
    testsComplete: num(s.testsComplete) ?? 0,
    plannedQuestions: num(s.plannedQuestions) ?? 0,
    drafted: num(s.drafted) ?? 0,
    verified: num(s.verified) ?? 0,
    selfChecked: num(s.selfChecked) ?? 0,
    draft: num(s.draft) ?? 0,
    needsReview: num(s.needsReview) ?? 0,
    fixedDuringVerification: num(s.fixedDuringVerification) ?? 0,
    remaining: num(s.remaining) ?? 0,
    tests: tests.sort((a, b) => a.test.localeCompare(b.test, "en", { numeric: true })),
  };
}

/** "2026-09-29T21:18:26.264Z" → "29 Sep 2026, 21:18 UTC" (timezone-independent). */
export function formatStamp(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]} UTC`;
}
