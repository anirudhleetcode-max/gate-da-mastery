/**
 * Structure of a mock test for the list and intro pages: tiers, sections,
 * question-type counts, subject distribution and the marking scheme.
 * Pure and isomorphic (used by server components).
 */
import type { ExamPattern, MockTier, QuestionType, SubjectId } from "@/lib/content/schema";
import { SUBJECT_ORDER } from "@/lib/labels";
import type { MockSummary, MockTestDef } from "./types";

export const TIER_ORDER: MockTier[] = ["FOUNDATION", "BEGINNER_INTERMEDIATE", "INTERMEDIATE", "ADVANCED", "FULL_GATE"];

/** What each tier trains, in the order the tiers are meant to be taken. */
export const TIER_EXPLANATION: Record<MockTier, string> = {
  FOUNDATION: "Short subject-wise tests on definitions, core formulas, basic calculations and standard algorithms. Take them while you study each subject.",
  BEGINNER_INTERMEDIATE: "Mixed-subject tests with more calculation, combined concepts and multi-step reasoning under moderate time pressure.",
  INTERMEDIATE: "GATE-level conceptual problems with calculation traps and multi-topic reasoning, plus a few General Aptitude questions.",
  ADVANCED: "Deeper multi-concept reasoning, heavier numerical work and closely argued options. Includes General Aptitude.",
  FULL_GATE: "Full simulations of the DA paper: 65 questions, 100 marks, 180 minutes, GA and DA sections, GATE negative marking.",
};

/** The fixed section plan of a full GATE DA simulation (from the verified exam pattern). */
export const FULL_GATE_SECTIONS: SectionInfo[] = [
  { section: "GA", label: "General Aptitude", firstQ: 1, lastQ: 10, count: 10, marks: 15, oneMark: 5, twoMark: 5 },
  { section: "DA", label: "Data Science & AI", firstQ: 11, lastQ: 65, count: 55, marks: 85, oneMark: 25, twoMark: 30 },
];

/** "Mock 7: Foundation — Machine Learning" → "Foundation — Machine Learning". */
export function shortTitle(title: string): string {
  return title.replace(/^Mock\s+\d+\s*:\s*/i, "").trim() || title;
}

/** "mock-07" → 7 */
export function mockNumber(testId: string): number {
  const n = Number(testId.replace(/^mock-/, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Total marks to show for a mock. For a complete paper this is the sum of its
 * question marks. For an incomplete paper the sum would be misleading, so it is
 * null, except for a full simulation, whose total is fixed at 100 by the pattern.
 */
export function displayTotalMarks(test: Pick<MockTestDef, "available" | "totalMarks" | "tier">): number | null {
  if (test.available) return test.totalMarks;
  return test.tier === "FULL_GATE" ? 100 : null;
}

export function toSummary(test: MockTestDef): MockSummary {
  return {
    id: test.id,
    number: test.number,
    tier: test.tier,
    title: test.title,
    shortTitle: shortTitle(test.title),
    description: test.description,
    questionCount: test.questionIds.length,
    totalMarks: displayTotalMarks(test),
    durationMinutes: test.durationMinutes,
    negativeMarking: test.negativeMarking,
    available: test.available,
  };
}

export interface SectionInfo {
  section: "GA" | "DA";
  label: string;
  /** 1-based question numbers of the section in paper order. */
  firstQ: number;
  lastQ: number;
  count: number;
  marks: number;
  oneMark: number;
  twoMark: number;
}

const SECTION_LABEL = { GA: "General Aptitude", DA: "Data Science & AI" } as const;

/** Contiguous sections of a paper (questions in paper order). */
export function sectionStructure(questions: readonly { section?: "GA" | "DA"; marks: number }[]): SectionInfo[] {
  const out: SectionInfo[] = [];
  questions.forEach((q, i) => {
    const section = q.section ?? "DA";
    let last = out[out.length - 1];
    if (!last || last.section !== section) {
      last = { section, label: SECTION_LABEL[section], firstQ: i + 1, lastQ: i + 1, count: 0, marks: 0, oneMark: 0, twoMark: 0 };
      out.push(last);
    }
    last.lastQ = i + 1;
    last.count++;
    last.marks += q.marks;
    if (q.marks === 1) last.oneMark++;
    else if (q.marks === 2) last.twoMark++;
  });
  return out;
}

export function typeCounts(questions: readonly { type: QuestionType }[]): Record<QuestionType, number> {
  const out: Record<QuestionType, number> = { MCQ: 0, MSQ: 0, NAT: 0 };
  for (const q of questions) out[q.type]++;
  return out;
}

export interface SubjectShare {
  subjectId: SubjectId;
  count: number;
  marks: number;
}

/** Questions and marks per subject, in the platform's fixed subject order. */
export function subjectDistribution(questions: readonly { subjectId: SubjectId; marks: number }[]): SubjectShare[] {
  const m = new Map<SubjectId, SubjectShare>();
  for (const q of questions) {
    const s = m.get(q.subjectId) ?? { subjectId: q.subjectId, count: 0, marks: 0 };
    s.count++;
    s.marks += q.marks;
    m.set(q.subjectId, s);
  }
  return SUBJECT_ORDER.filter((s) => m.has(s)).map((s) => m.get(s)!);
}

export interface MarkingRule {
  label: string;
  value: string;
}

function fraction(x: number): string {
  const known: [number, string][] = [
    [1 / 3, "1/3"],
    [2 / 3, "2/3"],
    [1 / 4, "1/4"],
    [1 / 2, "1/2"],
  ];
  for (const [v, s] of known) if (Math.abs(x - v) < 1e-9) return s;
  return String(Math.round(x * 100) / 100);
}

/**
 * One-line marking hint for a question in the exam, e.g. "Wrong answer: −1/3 mark"
 * for a 1-mark MCQ, "No negative marking" for MSQ and NAT.
 */
export function negativeHint(type: QuestionType, marks: number, negativeMarking: boolean, pattern?: ExamPattern | null): string {
  if (type !== "MCQ" || !negativeMarking) return "No negative marking";
  const f = pattern?.marking.mcqNegativeFraction ?? 1 / 3;
  return `Wrong answer: −${fraction(f * marks)} mark`;
}

/**
 * The marking scheme as display rules, taken from the verified exam pattern
 * (pattern.json). When a mock has negative marking switched off, MCQ
 * penalties are reported as not applying.
 */
export function markingRules(pattern: ExamPattern | null, negativeMarking: boolean): MarkingRule[] {
  const m = pattern?.marking;
  const f = m?.mcqNegativeFraction ?? 1 / 3;
  const rules: MarkingRule[] = [
    { label: "Correct answer", value: "Full marks for the question (1 or 2)" },
    {
      label: "Wrong MCQ",
      value: negativeMarking ? `−${fraction(f)} for a 1-mark MCQ, −${fraction(2 * f)} for a 2-mark MCQ` : "No negative marking in this mock",
    },
    {
      label: "Wrong MSQ or NAT",
      value: (m?.msqNegative ?? 0) === 0 && (m?.natNegative ?? 0) === 0 ? "No negative marking" : `MSQ −${m?.msqNegative}, NAT −${m?.natNegative}`,
    },
    {
      label: "Partial marks",
      value: m?.msqPartialCredit ? "Partial credit for MSQ" : "None: an MSQ scores only when every correct option and no wrong option is chosen",
    },
    { label: "NAT answers", value: "Any value inside the accepted range scores full marks" },
    { label: "Unanswered", value: "0 marks" },
  ];
  return rules;
}
