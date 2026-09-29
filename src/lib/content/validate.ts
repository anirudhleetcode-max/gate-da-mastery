/**
 * Semantic validation beyond the Zod shape checks: taxonomy consistency,
 * answer/type agreement, official-key agreement for PYQs, figure existence.
 * Pure functions – used by the content build, the single-file CLI and tests.
 */
import type { Answer, OriginalQuestion, Pyq, Syllabus, QuestionType } from "./schema";

export interface Issue {
  level: "error" | "warning";
  entity: string;
  message: string;
}

export interface TaxonomyIndex {
  subjects: Set<string>;
  topics: Map<string, string>; // topicId -> subjectId
  subtopics: Map<string, string>; // subtopicId -> topicId
}

export function buildTaxonomyIndex(syllabus: Syllabus): TaxonomyIndex {
  const idx: TaxonomyIndex = { subjects: new Set(), topics: new Map(), subtopics: new Map() };
  for (const s of syllabus.subjects) {
    idx.subjects.add(s.id);
    for (const t of s.topics) {
      idx.topics.set(t.id, s.id);
      for (const st of t.subtopics) idx.subtopics.set(st.id, t.id);
    }
  }
  return idx;
}

/** Parse an official answer-key cell ("A", "A;C", "0.12 to 0.13", "MTA"). */
export function parseOfficialKey(raw: string, type: QuestionType): Answer | null {
  const s = raw.trim();
  if (s.toUpperCase() === "MTA") return { kind: "MTA", note: "Marks to all (official key)" };
  if (type === "NAT") {
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*to\s*(-?\d+(?:\.\d+)?)$/i);
    if (!m) return null;
    return { kind: "NAT", min: Number(m[1]), max: Number(m[2]) };
  }
  const labels = s.split(/[;,]/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  if (!labels.every((l) => ["A", "B", "C", "D"].includes(l))) return null;
  if (type === "MCQ") return labels.length === 1 ? { kind: "MCQ", correct: labels[0] as "A" } : null;
  return { kind: "MSQ", correct: [...labels].sort() as ("A" | "B" | "C" | "D")[] };
}

export function answersEqual(a: Answer, b: Answer): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "MCQ":
      return a.correct === (b as typeof a).correct;
    case "MSQ": {
      const x = [...a.correct].sort().join();
      const y = [...(b as typeof a).correct].sort().join();
      return x === y;
    }
    case "NAT":
      return a.min === (b as typeof a).min && a.max === (b as typeof a).max;
    case "MTA":
      return true;
  }
}

type AnyQuestion = Pyq | OriginalQuestion;

export function validateQuestionSemantics(
  q: AnyQuestion,
  tax: TaxonomyIndex,
  opts: { figureExists?: (publicPath: string) => boolean } = {},
): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", entity: q.id, message });
  const warn = (message: string) => issues.push({ level: "warning", entity: q.id, message });

  // Taxonomy
  if (!tax.subjects.has(q.subjectId)) err(`unknown subjectId ${q.subjectId}`);
  const topicSubject = tax.topics.get(q.topicId);
  if (!topicSubject) err(`unknown topicId ${q.topicId}`);
  else if (topicSubject !== q.subjectId) err(`topic ${q.topicId} belongs to ${topicSubject}, not ${q.subjectId}`);
  for (const st of q.subtopicIds) {
    const t = tax.subtopics.get(st);
    if (!t) err(`unknown subtopicId ${st}`);
    else if (tax.topics.get(t) !== q.subjectId) err(`subtopic ${st} is outside subject ${q.subjectId}`);
  }
  if (q.subtopicIds.length && !q.subtopicIds.some((st) => tax.subtopics.get(st) === q.topicId)) {
    err(`none of the subtopicIds belongs to the primary topic ${q.topicId}`);
  }

  // Type / options / answer agreement
  if (q.type === "NAT") {
    if (q.options.length) err("NAT question must not have options");
  } else {
    const labels = q.options.map((o) => o.label).join("");
    if (labels !== "ABCD") err(`MCQ/MSQ must have options A–D in order (got "${labels}")`);
  }
  const a = q.answer;
  if (a.kind !== "MTA" && a.kind !== q.type) err(`answer kind ${a.kind} does not match type ${q.type}`);
  if (a.kind === "MSQ") {
    if (new Set(a.correct).size !== a.correct.length) err("duplicate MSQ labels");
  }
  if (a.kind === "NAT") {
    if (!(a.min <= a.max)) err(`NAT range invalid: ${a.min} > ${a.max}`);
    if (!Number.isFinite(a.min) || !Number.isFinite(a.max)) err("NAT bounds must be finite");
  }
  if (a.kind === "MTA" && q.origin !== "OFFICIAL_PYQ") err("MTA answers are only valid for official PYQs");

  // Marks
  if (q.origin === "OFFICIAL_PYQ" || q.origin === "MOCK_TEST") {
    if (q.marks !== 1 && q.marks !== 2) err(`GATE questions carry 1 or 2 marks (got ${q.marks})`);
  }

  // Solution quality floor
  const sol = q.solution;
  if (sol.steps.length < 2) err("solution needs at least 2 steps");
  if (q.type !== "NAT" && a.kind !== "MTA") {
    if (!sol.optionAnalysis || sol.optionAnalysis.length !== 4) {
      warn("MCQ/MSQ solution should analyse all four options");
    } else {
      const correctSet = new Set(a.kind === "MCQ" ? [a.correct] : a.kind === "MSQ" ? a.correct : []);
      for (const oa of sol.optionAnalysis) {
        const shouldBe = correctSet.has(oa.label) ? "correct" : "incorrect";
        if (oa.verdict !== shouldBe) err(`optionAnalysis for ${oa.label} says ${oa.verdict} but answer implies ${shouldBe}`);
      }
    }
  }

  // Figures referenced in markdown must exist
  if (opts.figureExists) {
    const texts = [q.stem, ...q.options.map((o) => o.text), ...sol.steps.map((s) => s.body)];
    for (const t of texts) {
      for (const m of t.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (!opts.figureExists(m[1])) err(`referenced figure not found: ${m[1]}`);
      }
    }
  }

  // PYQ-specific
  if (q.origin === "OFFICIAL_PYQ") {
    const p = q as Pyq;
    const m = p.id.match(/^DA(\d{4})-S(\d+)-Q(\d{2})$/);
    if (m) {
      if (Number(m[1]) !== p.year) err("id year does not match year");
      if (Number(m[3]) !== p.questionNumber) err("id question number does not match questionNumber");
    }
    const expectedSection = p.questionNumber <= 10 ? "GA" : "DA";
    if (p.section !== expectedSection) err(`Q${p.questionNumber} must be in section ${expectedSection}`);
    if ((p.section === "GA") !== (p.subjectId === "ga")) err("GA section questions must use subject ga (and only they)");
    const expectedMarks = p.questionNumber <= 5 || (p.questionNumber >= 11 && p.questionNumber <= 35) ? 1 : 2;
    if (p.marks !== expectedMarks) err(`Q${p.questionNumber} should carry ${expectedMarks} mark(s) under the paper structure`);
    const parsed = parseOfficialKey(p.officialKeyRaw, p.type);
    if (!parsed) err(`cannot parse officialKeyRaw "${p.officialKeyRaw}" for type ${p.type}`);
    else if (!answersEqual(parsed, p.answer)) err(`answer does not match official key "${p.officialKeyRaw}"`);
    if (p.answerVerification.status === "VERIFIED" && !p.answerVerification.agreesWithKey) {
      err("answer marked VERIFIED but independent solve disagrees with the official key");
    }
    if (p.difficultyRationale && !/platform/i.test(p.difficultyRationale)) {
      warn("difficultyRationale should state that the difficulty is platform-estimated");
    }
  } else {
    const o = q as OriginalQuestion;
    if (o.origin === "MOCK_TEST" && !o.testId) err("mock question must have testId");
    if (o.answerVerification.status === "VERIFIED" && !o.answerVerification.agreesWithKey) {
      err("original question marked VERIFIED but independent verification disagrees");
    }
  }
  return issues;
}

/** Normalise question text for duplicate detection. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\$+/g, " ")
    .replace(/\\[a-z]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable 64-bit-ish FNV-1a fingerprint of normalised text (hex). */
export function fingerprint(s: string): string {
  const t = normalizeText(s);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Word-shingle Jaccard similarity (k=3) for near-duplicate detection. */
export function shingleSimilarity(a: string, b: string, k = 3): number {
  const sh = (s: string) => {
    const w = normalizeText(s).split(" ").filter(Boolean);
    const set = new Set<string>();
    if (w.length < k) {
      if (w.length) set.add(w.join(" "));
      return set;
    }
    for (let i = 0; i + k <= w.length; i++) set.add(w.slice(i, i + k).join(" "));
    return set;
  };
  const A = sh(a);
  const B = sh(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface DuplicateFinding {
  a: string;
  b: string;
  kind: "exact" | "near";
  similarity: number;
}

/** Detect exact (fingerprint) and near (shingle ≥ threshold) duplicates. */
export function findDuplicates(
  items: { id: string; text: string }[],
  threshold = 0.8,
): DuplicateFinding[] {
  const out: DuplicateFinding[] = [];
  const byFp = new Map<string, string>();
  for (const it of items) {
    const fp = fingerprint(it.text);
    const prev = byFp.get(fp);
    if (prev) out.push({ a: prev, b: it.id, kind: "exact", similarity: 1 });
    else byFp.set(fp, it.id);
  }
  const exactPairs = new Set(out.map((d) => `${d.a}|${d.b}`));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (exactPairs.has(`${a.id}|${b.id}`) || exactPairs.has(`${b.id}|${a.id}`)) continue;
      // cheap length pre-filter
      const la = a.text.length;
      const lb = b.text.length;
      if (Math.min(la, lb) / Math.max(la, lb) < 0.5) continue;
      const s = shingleSimilarity(a.text, b.text);
      if (s >= threshold) out.push({ a: a.id, b: b.id, kind: "near", similarity: Math.round(s * 1000) / 1000 });
    }
  }
  return out;
}
