/**
 * npm run content:mock-review [-- --tests mock-01,mock-02] [--dry-run]
 *
 * Applies the deterministic review gates (src/lib/content/review.ts) to mock
 * and practice questions, writes each question's `review` record, and writes
 * a batch report to reports/mock-verification.{json,md}.
 *
 * Files touched by an agent in the last 10 minutes are skipped so a running
 * verifier is never raced. VERIFIED questions whose content has not changed
 * are left byte-identical (their review record is only rewritten if a gate
 * result changes).
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { OriginalQuestion, Pyq, Syllabus } from "../../src/lib/content/schema";
import { buildTaxonomyIndex } from "../../src/lib/content/validate";
import { reviewQuestion, reviewText, type BlueprintSlot } from "../../src/lib/content/review";

const ROOT = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const only = (() => {
  const i = args.indexOf("--tests");
  return i >= 0 ? new Set(args[i + 1].split(",")) : null;
})();
const dry = args.includes("--dry-run");
const today = new Date().toISOString().slice(0, 10);

const syllabus = Syllabus.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "content/syllabus.json"), "utf8")));
const tax = buildTaxonomyIndex(syllabus);
const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, "content/mocks/blueprint.json"), "utf8")) as Record<string, { tier: string; slots: BlueprintSlot[] }>;

const qdir = path.join(ROOT, "content/mocks/questions");
const pdir = path.join(ROOT, "content/practice");
const files = [
  ...fs.readdirSync(qdir).filter((f) => f.endsWith(".json")).map((f) => path.join(qdir, f)),
  ...(fs.existsSync(pdir) ? fs.readdirSync(pdir).filter((f) => f.endsWith(".json")).map((f) => path.join(pdir, f)) : []),
];
const loaded = files.map((f) => ({ file: f, qs: z.array(OriginalQuestion).parse(JSON.parse(fs.readFileSync(f, "utf8"))) }));

const pyqs: { id: string; text: string; official: boolean }[] = [];
for (const y of fs.readdirSync(path.join(ROOT, "content/pyqs"))) {
  for (const f of fs.readdirSync(path.join(ROOT, "content/pyqs", y))) {
    const p = Pyq.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "content/pyqs", y, f), "utf8")));
    pyqs.push({ id: p.id, text: reviewText(p), official: true });
  }
}
const corpus = [...pyqs, ...loaded.flatMap((l) => l.qs.map((q) => ({ id: q.id, text: reviewText(q), official: false })))];

type Row = { id: string; testId?: string; status: string; fixed: boolean; failures: string[] };
const rows: Row[] = [];
const recentMs = 10 * 60 * 1000;
let written = 0;
let skippedBusy = 0;

for (const { file, qs } of loaded) {
  const testId = qs[0]?.testId;
  if (only && testId && !only.has(testId)) continue;
  const busy = Date.now() - fs.statSync(file).mtimeMs < recentMs;
  let changed = false;
  for (const q of qs) {
    const slot = q.testId ? blueprint[q.testId]?.slots.find((s) => s.q === q.questionNumber) : undefined;
    const r = reviewQuestion(q, { tax, slot, corpus, today, previous: q.review });
    rows.push({ id: q.id, testId: q.testId, status: r.status, fixed: r.fixed, failures: r.failures });
    const { failures: _f, ...record } = r;
    void _f;
    const prev = q.review;
    const same =
      prev &&
      prev.status === record.status &&
      JSON.stringify(prev.checks) === JSON.stringify(record.checks) &&
      prev.notes === record.notes &&
      JSON.stringify(prev.verifiedHash) === JSON.stringify(record.verifiedHash);
    if (!same) {
      (q as { review?: typeof record }).review = { ...record, reviewedAt: prev && prev.status === record.status ? prev.reviewedAt : today };
      changed = true;
    }
  }
  if (changed && !dry) {
    if (busy) {
      skippedBusy++;
      continue;
    }
    // Preserve the original key order: re-read raw JSON and merge review records.
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>[];
    const byId = new Map(qs.map((q) => [q.id, q.review]));
    for (const r of raw) r.review = byId.get(r.id as string);
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
    written++;
  }
}

// ---------------------------------------------------------------- report
const tests = [...new Set(rows.map((r) => r.testId ?? "practice"))].sort();
const per = tests.map((t) => {
  const rs = rows.filter((r) => (r.testId ?? "practice") === t);
  const planned = blueprint[t]?.slots.length ?? rs.length;
  const count = (s: string) => rs.filter((r) => r.status === s).length;
  return {
    test: t,
    planned,
    present: rs.length,
    verified: count("VERIFIED"),
    selfChecked: count("SELF_CHECKED"),
    draft: count("DRAFT"),
    needsReview: count("NEEDS_REVIEW"),
    fixedDuringVerification: rs.filter((r) => r.fixed && r.status === "VERIFIED").length,
    rejectedByGates: rs.filter((r) => r.status === "NEEDS_REVIEW" && r.failures.some((f) => !f.startsWith("independent verifier"))).length,
    complete: rs.length === planned && count("VERIFIED") === planned,
    issues: rs.filter((r) => r.failures.length).map((r) => `${r.id}: ${r.failures.join("; ")}`),
  };
});
const total = (k: keyof (typeof per)[number]) => per.reduce((a, p) => a + (typeof p[k] === "number" ? (p[k] as number) : 0), 0);
const allPlanned = Object.values(blueprint).reduce((a, b) => a + b.slots.length, 0);
const summary = {
  generatedAt: new Date().toISOString(),
  testsComplete: per.filter((p) => p.complete && p.test.startsWith("mock-")).length,
  plannedQuestions: allPlanned,
  drafted: total("present"),
  verified: total("verified"),
  selfChecked: total("selfChecked"),
  draft: total("draft"),
  needsReview: total("needsReview"),
  fixedDuringVerification: total("fixedDuringVerification"),
  remaining: allPlanned - total("verified"),
  filesWritten: written,
  filesSkippedBecauseBusy: skippedBusy,
};
if (!dry) {
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports/mock-verification.json"), JSON.stringify({ summary, tests: per }, null, 2) + "\n");
  const md = [
    "# Mock verification report",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `- Tests complete (every question VERIFIED): **${summary.testsComplete}/50**`,
    `- Questions: ${summary.drafted}/${summary.plannedQuestions} drafted, **${summary.verified} VERIFIED**, ${summary.selfChecked} SELF_CHECKED, ${summary.draft} DRAFT, ${summary.needsReview} NEEDS_REVIEW, ${summary.remaining} remaining to verify`,
    `- Fixed during independent verification (then verified): ${summary.fixedDuringVerification}`,
    "",
    "| Test | Planned | Present | Verified | Fixed | Self-checked | Needs review | Rejected by gates | Complete |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...per.map((p) => `| ${p.test} | ${p.planned} | ${p.present} | ${p.verified} | ${p.fixedDuringVerification} | ${p.selfChecked} | ${p.needsReview} | ${p.rejectedByGates} | ${p.complete ? "yes" : "no"} |`),
    "",
    "## Issues",
    ...per.flatMap((p) => p.issues.map((i) => `- ${i}`)),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, "reports/mock-verification.md"), md);
}
console.log(JSON.stringify(summary, null, 2));
