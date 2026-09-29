/**
 * Deterministic review gates for original (mock/practice) questions.
 *
 * The expensive, judgement-heavy steps (independent solve, answer comparison,
 * solution review) are done by an independent verifier and recorded in
 * `answerVerification`. The mechanical steps are done here, identically for
 * every question: metadata consistency, blueprint conformance, duplicates,
 * originality against official PYQs, estimated-time sanity.
 */
import crypto from "node:crypto";
import { renderMarkdown } from "./markdown";
import type { OriginalQuestion, ReviewRecord, ReviewStatus } from "./schema";
import type { TaxonomyIndex } from "./validate";
import { textSimilarity, validateQuestionSemantics } from "./validate";

export interface BlueprintSlot {
  q: number;
  section: "GA" | "DA";
  subjectId: string;
  topicId: string;
  subtopicId: string;
  type: "MCQ" | "MSQ" | "NAT";
  marks: number;
  difficulty: "EASY" | "MODERATE" | "HARD" | "VERY_HARD";
}

export interface ReviewContext {
  tax: TaxonomyIndex;
  /** Blueprint slot for this question (mock questions only). */
  slot?: BlueprintSlot;
  /** Other questions' text (stem + options, see reviewText) for duplicate detection. */
  corpus: { id: string; text: string; official: boolean }[];
  today: string;
  /** The review record already stored on the question, if any. */
  previous?: ReviewRecord;
}

/** JSON with object keys sorted recursively, so hashes ignore key order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Content hash (everything a student sees or is scored on) and verification-record hash. */
export function questionHashes(q: OriginalQuestion): { content: string; verification: string } {
  const { review: _r, answerVerification, ...content } = q;
  void _r;
  return { content: sha(stable(content)), verification: sha(stable(answerVerification)) };
}

/** Every Markdown field of a question with a label, for formatting and placeholder checks. */
export function textFields(q: OriginalQuestion): [string, string][] {
  const s = q.solution;
  return [
    ["stem", q.stem],
    ...(q.options ?? []).map((o) => [`option ${o.label}`, o.text] as [string, string]),
    ["solution.quick", s.quick],
    ...s.steps.flatMap((st, i) => [[`step ${i + 1} title`, st.title], [`step ${i + 1}`, st.body]] as [string, string][]),
    ["solution.finalAnswer", s.finalAnswer],
    ...(s.teaching ? [["solution.teaching", s.teaching] as [string, string]] : []),
    ...(s.optionAnalysis ?? []).map((o) => [`analysis ${o.label}`, o.explanation] as [string, string]),
    ...(s.shortcut ? [["solution.shortcut", s.shortcut] as [string, string]] : []),
    ...(s.commonTrap ? [["solution.commonTrap", s.commonTrap] as [string, string]] : []),
    ["concept", q.concept ?? ""],
    ["difficultyRationale", q.difficultyRationale],
  ];
}

const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX|lorem ipsum|placeholder)\b|\?\?\?|\[insert/i;
const LEAK_STEM = /\b(the )?(correct )?(answer|option) is\b|\bans(wer)?\s*[:=]/i;
const LEAK_OPTION = /\((correct|right|answer)\)|[✓✔]|\bcorrect answer\b/i;

/** Unescaped `$` delimiters outside code must pair up, or math renders as raw text. */
function unbalancedDollars(md: string): boolean {
  const noCode = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  const n = (noCode.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  return n % 2 === 1;
}

const DIFF = ["EASY", "MODERATE", "HARD", "VERY_HARD"];
/** Calibrated on the corpus: one-word edits score ≈0.91, number-only clones ≈0.81, distinct items ≤0.6. */
export const DUPLICATE_THRESHOLD = 0.8;
/** Distinct originals score ≤0.3 against official PYQs; a close paraphrase scores well above 0.6. */
export const PYQ_SIMILARITY_THRESHOLD = 0.6;

/** The text compared for duplicates: stem plus option texts (short stems carry their content in the options). */
export function reviewText(q: { stem: string; options?: { text: string }[] }): string {
  return [q.stem, ...(q.options ?? []).map((o) => o.text)].join("\n");
}

export function reviewQuestion(q: OriginalQuestion, ctx: ReviewContext): ReviewRecord & { failures: string[] } {
  const failures: string[] = [];
  const av = q.answerVerification;
  const checks: Record<string, boolean> = {};

  // 1. Author self-check (computational check or recorded derivation)
  // A verifier-stage record implies an author draft existed (conceptual items may have no code).
  const verifierDone = av.status === "VERIFIED" || av.status === "NEEDS_REVIEW";
  checks.selfCheck = Boolean(av && av.method && (av.checkCode || /derivation|check/i.test(av.method) || verifierDone));

  // 2. Independent solve + answer comparison + solution review (agent stage)
  checks.independentSolve = av.status === "VERIFIED" && av.agreesWithKey && /independent|blind/i.test(av.method);
  if (av.status === "NEEDS_REVIEW") failures.push(`independent verifier flagged: ${av.notes || "see answerVerification"}`);

  // 3. Metadata / schema semantics (taxonomy, type-answer-options agreement, marks, option verdicts)
  const sem = validateQuestionSemantics(q, ctx.tax).filter((i) => i.level === "error");
  checks.metadata = sem.length === 0;
  for (const e of sem) failures.push(`metadata: ${e.message}`);

  // 4. Blueprint conformance
  if (ctx.slot) {
    const s = ctx.slot;
    const mismatch: string[] = [];
    if (q.subjectId !== s.subjectId) mismatch.push(`subject ${q.subjectId}≠${s.subjectId}`);
    if (q.topicId !== s.topicId) mismatch.push(`topic ${q.topicId}≠${s.topicId}`);
    if (q.type !== s.type) mismatch.push(`type ${q.type}≠${s.type}`);
    if (q.marks !== s.marks) mismatch.push(`marks ${q.marks}≠${s.marks}`);
    if ((q.section ?? "DA") !== s.section) mismatch.push(`section ${q.section}≠${s.section}`);
    if (q.questionNumber !== s.q) mismatch.push(`number ${q.questionNumber}≠${s.q}`);
    if (Math.abs(DIFF.indexOf(q.difficulty) - DIFF.indexOf(s.difficulty)) > 1) mismatch.push(`difficulty ${q.difficulty} far from planned ${s.difficulty}`);
    checks.blueprint = mismatch.length === 0;
    for (const m of mismatch) failures.push(`blueprint: ${m}`);
  }

  // 5. Estimated time sanity
  const t = q.estimatedTimeSec;
  checks.estimatedTime = t >= 20 && t <= 900 && (q.marks === 1 ? t <= 480 : true);
  if (!checks.estimatedTime) failures.push(`estimatedTimeSec ${t} outside the plausible range`);

  // 6. Solution completeness
  const sol = q.solution;
  checks.solution = sol.steps.length >= 2 && sol.finalAnswer.trim().length > 0 && sol.quick.trim().length > 0 && (q.type === "NAT" || (sol.optionAnalysis?.length ?? 0) === 4);
  if (!checks.solution) failures.push("solution incomplete (steps, quick, finalAnswer or option analysis)");

  // 6b. Formatting: KaTeX must render, `$` delimiters must pair, no placeholders left behind
  const fmt: string[] = [];
  const placeholders: string[] = [];
  for (const [label, md] of textFields(q)) {
    if (!md) continue;
    if (PLACEHOLDER.test(md)) placeholders.push(label);
    if (unbalancedDollars(md)) fmt.push(`${label}: unbalanced $ delimiters`);
    for (const e of renderMarkdown(md).errors) fmt.push(`${label}: ${e}`);
  }
  checks.formatting = fmt.length === 0;
  for (const f of fmt) failures.push(`formatting: ${f}`);
  checks.noPlaceholders = placeholders.length === 0;
  if (!checks.noPlaceholders) failures.push(`placeholder text in ${placeholders.join(", ")}`);

  // 6c. The stem and options must not give the answer away; options must be distinct
  const leaks: string[] = [];
  if (LEAK_STEM.test(q.stem)) leaks.push("stem states the answer");
  for (const o of q.options ?? []) if (LEAK_OPTION.test(o.text)) leaks.push(`option ${o.label} is marked as correct`);
  const optionTexts = (q.options ?? []).map((o) => o.text.replace(/\s+/g, " ").trim().toLowerCase());
  if (new Set(optionTexts).size !== optionTexts.length) leaks.push("two options have identical text");
  checks.noAnswerLeak = leaks.length === 0;
  for (const l of leaks) failures.push(`answer leak: ${l}`);

  // 6d. Edited after verification? (content changed but the verification record did not)
  const hashes = questionHashes(q);
  const pv = ctx.previous?.verifiedHash;
  checks.unchangedSinceVerification = !(pv && pv.content !== hashes.content && pv.verification === hashes.verification);
  if (!checks.unchangedSinceVerification) failures.push("content changed after verification without a new independent verification");

  // 7. Duplicates within original content, and similarity to official PYQs
  let worstDup = 0;
  let worstPyq = 0;
  let dupWith = "";
  let pyqWith = "";
  const mine = reviewText(q);
  for (const other of ctx.corpus) {
    if (other.id === q.id) continue;
    const la = mine.length;
    const lb = other.text.length;
    if (Math.min(la, lb) / Math.max(la, lb) < 0.4) continue;
    const s = textSimilarity(mine, other.text);
    if (other.official) {
      if (s > worstPyq) [worstPyq, pyqWith] = [s, other.id];
    } else if (s > worstDup) [worstDup, dupWith] = [s, other.id];
  }
  checks.noDuplicate = worstDup < DUPLICATE_THRESHOLD;
  if (!checks.noDuplicate) failures.push(`near-duplicate of ${dupWith} (similarity ${worstDup.toFixed(2)})`);
  checks.original = worstPyq < PYQ_SIMILARITY_THRESHOLD;
  if (!checks.original) failures.push(`too similar to official ${pyqWith} (similarity ${worstPyq.toFixed(2)})`);

  const status: ReviewStatus = av.status === "NEEDS_REVIEW"
    ? "NEEDS_REVIEW"
    : !checks.selfCheck
      ? "DRAFT"
      : !checks.independentSolve
        ? "SELF_CHECKED"
        : failures.length
          ? "NEEDS_REVIEW"
          : "VERIFIED";

  return {
    status,
    checks,
    // The verifier protocol marks every content correction with this phrase ("Nothing changed" must not count).
    fixed: /corrected during verification/i.test(`${av.method} ${av.notes ?? ""}`),
    notes: failures.join("; "),
    reviewedAt: ctx.today,
    // Sticky: refreshed only when the question (re)reaches VERIFIED.
    ...(status === "VERIFIED" ? { verifiedHash: hashes } : pv ? { verifiedHash: pv } : {}),
    failures,
  };
}
