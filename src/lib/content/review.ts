/**
 * Deterministic review gates for original (mock/practice) questions.
 *
 * The expensive, judgement-heavy steps (independent solve, answer comparison,
 * solution review) are done by an independent verifier and recorded in
 * `answerVerification`. The mechanical steps are done here, identically for
 * every question: metadata consistency, blueprint conformance, duplicates,
 * originality against official PYQs, estimated-time sanity.
 */
import type { OriginalQuestion, ReviewRecord, ReviewStatus } from "./schema";
import type { TaxonomyIndex } from "./validate";
import { shingleSimilarity, validateQuestionSemantics } from "./validate";

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
  /** Other questions' stems (id → plain text) for duplicate detection. */
  corpus: { id: string; text: string; official: boolean }[];
  today: string;
}

const DIFF = ["EASY", "MODERATE", "HARD", "VERY_HARD"];
export const DUPLICATE_THRESHOLD = 0.85;
export const PYQ_SIMILARITY_THRESHOLD = 0.6;

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

  // 7. Duplicates within original content, and similarity to official PYQs
  let worstDup = 0;
  let worstPyq = 0;
  let dupWith = "";
  let pyqWith = "";
  for (const other of ctx.corpus) {
    if (other.id === q.id) continue;
    const la = q.stem.length;
    const lb = other.text.length;
    if (Math.min(la, lb) / Math.max(la, lb) < 0.4) continue;
    const s = shingleSimilarity(q.stem, other.text);
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
    fixed: /corrected during verification/i.test(av.method) || /\b(fixed|corrected|rewrote|changed)\b/i.test(av.notes ?? ""),
    notes: failures.join("; "),
    reviewedAt: ctx.today,
    failures,
  };
}
