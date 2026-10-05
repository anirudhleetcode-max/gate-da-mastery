/**
 * npm run content:stats [-- --json]
 *
 * The single source of truth for the numbers quoted in status reports and
 * the README: every count is read from the content files in this repository
 * at the moment the script runs. Mock counts use the review records stored in
 * the files, which is what the app uses; run npm run content:mock-review
 * first so they are current.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const list = (rel: string) => (fs.existsSync(path.join(ROOT, rel)) ? fs.readdirSync(path.join(ROOT, rel)).filter((f) => f.endsWith(".json")) : []);

// ------------------------------------------------------------------ PYQs
type AnyQ = Record<string, unknown> & { id: string };
const pyqs: AnyQ[] = [];
for (const y of fs.readdirSync(path.join(ROOT, "content/pyqs"))) for (const f of list(`content/pyqs/${y}`)) pyqs.push(read(`content/pyqs/${y}/${f}`));
const weakest = (q: AnyQ) => {
  const s = [(q.transcription as { status: string }).status, (q.answerVerification as { status: string }).status, q.solutionStatus as string];
  return s.includes("NEEDS_REVIEW") ? "NEEDS_REVIEW" : s.every((x) => x === "VERIFIED") ? "VERIFIED" : "PARTIALLY_VERIFIED";
};
const sources = new Map((read("content/sources.json") as { id: string; verificationStatus: string }[]).map((s) => [s.id, s.verificationStatus]));
/** The badge the app shows: also includes the weakest source status (as in src/lib/content/compile.ts). */
const badge = (q: AnyQ) => {
  const src = (q.sourceIds as string[]).map((id) => sources.get(id) ?? "NEEDS_REVIEW");
  const all = [...src, weakest(q)];
  return all.includes("NEEDS_REVIEW") ? "NEEDS_REVIEW" : all.every((x) => x === "VERIFIED") ? "VERIFIED" : "PARTIALLY_VERIFIED";
};
const papers = read("content/exam/papers.json") as { id: string; year: number }[];
const freeze = fs.existsSync(path.join(ROOT, "content/exam/pyq-freeze.json")) ? read("content/exam/pyq-freeze.json") : null;

// ------------------------------------------------------------------ mocks
const tests = read("content/mocks/tests.json") as { id: string; questionIds: string[] }[];
const mockQs: AnyQ[] = list("content/mocks/questions").flatMap((f) => read(`content/mocks/questions/${f}`));
const status = (q: AnyQ) => (q.review as { status?: string } | undefined)?.status ?? "UNREVIEWED";
const byId = new Map(mockQs.map((q) => [q.id, q]));
const complete = tests.filter((t) => t.questionIds.every((id) => byId.has(id) && status(byId.get(id)!) === "VERIFIED"));
const planned = tests.reduce((a, t) => a + t.questionIds.length, 0);
const count = (s: string) => mockQs.filter((q) => status(q) === s).length;

// ------------------------------------------------------------------ learning content
const arr = (dir: string) => list(dir).flatMap((f) => read(`${dir}/${f}`) as unknown[]);
const concepts = arr("content/concepts");
const formulas = arr("content/formulas");
const strategy = fs.existsSync(path.join(ROOT, "content/strategy/articles.json")) ? (read("content/strategy/articles.json") as unknown[]) : [];
const roadmap = fs.existsSync(path.join(ROOT, "content/roadmap.json")) ? (read("content/roadmap.json") as unknown[]) : [];
const practice = arr("content/practice") as AnyQ[];

const out = {
  pyq: {
    papers: papers.map((p) => p.id),
    total: pyqs.length,
    /** Transcription, answer and solution all VERIFIED. */
    verified: pyqs.filter((q) => weakest(q) === "VERIFIED").length,
    partiallyVerified: pyqs.filter((q) => weakest(q) === "PARTIALLY_VERIFIED").length,
    needsReview: pyqs.filter((q) => weakest(q) === "NEEDS_REVIEW").length,
    /** Overall badge counts including source status. */
    badge: {
      VERIFIED: pyqs.filter((q) => badge(q) === "VERIFIED").length,
      PARTIALLY_VERIFIED: pyqs.filter((q) => badge(q) === "PARTIALLY_VERIFIED").length,
      NEEDS_REVIEW: pyqs.filter((q) => badge(q) === "NEEDS_REVIEW").length,
    },
    resolvedDisputes: pyqs.filter((q) => q.dispute).map((q) => q.id),
    frozen: freeze ? { count: freeze.count, refreezes: freeze.log?.length ?? 0 } : null,
  },
  mocks: {
    tests: tests.length,
    testsComplete: complete.length,
    completeIds: complete.map((t) => t.id),
    plannedQuestions: planned,
    drafted: mockQs.length,
    verified: count("VERIFIED"),
    selfChecked: count("SELF_CHECKED"),
    draft: count("DRAFT") + count("UNREVIEWED"),
    needsReview: count("NEEDS_REVIEW"),
    remainingToVerify: planned - count("VERIFIED"),
  },
  content: {
    concepts: concepts.length,
    formulas: formulas.length,
    strategyArticles: strategy.length,
    roadmapStages: roadmap.length,
    practiceQuestions: practice.length,
    practiceVerified: practice.filter((q) => status(q) === "VERIFIED").length,
  },
};

if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else {
  const p = out.pyq;
  const m = out.mocks;
  const c = out.content;
  console.log(
    [
      "PYQ",
      `  ${p.total} official questions across ${p.papers.length} papers (${p.papers.join(", ")})`,
      `  transcription + answer + solution: VERIFIED ${p.verified} · PARTIALLY_VERIFIED ${p.partiallyVerified} · NEEDS_REVIEW ${p.needsReview} · resolved disputes ${p.resolvedDisputes.length}${p.resolvedDisputes.length ? ` (${p.resolvedDisputes.join(", ")})` : ""}`,
      `  overall badge incl. source status: VERIFIED ${p.badge.VERIFIED} · PARTIALLY_VERIFIED ${p.badge.PARTIALLY_VERIFIED} · NEEDS_REVIEW ${p.badge.NEEDS_REVIEW}`,
      `  frozen: ${p.frozen ? `${p.frozen.count} files, ${p.frozen.refreezes} logged freeze event(s)` : "no"}`,
      "MOCKS",
      `  Tests complete: ${m.testsComplete}/${m.tests}`,
      `  Questions drafted: ${m.drafted}/${m.plannedQuestions}`,
      `  Questions verified: ${m.verified}`,
      `  Self-checked (awaiting independent verification): ${m.selfChecked}`,
      `  Drafted, not yet through the review gates: ${m.draft}`,
      `  Needs review: ${m.needsReview}`,
      `  Remaining to verify: ${m.remainingToVerify}`,
      "CONTENT",
      `  Concepts: ${c.concepts}`,
      `  Formulas: ${c.formulas}`,
      `  Strategy articles: ${c.strategyArticles}`,
      `  Roadmap stages: ${c.roadmapStages}`,
      `  Practice questions: ${c.practiceQuestions} (${c.practiceVerified} verified)`,
    ].join("\n"),
  );
}
