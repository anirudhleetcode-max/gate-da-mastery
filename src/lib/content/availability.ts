/**
 * The availability gate: what may be shown to students.
 *
 * - A mock test is available only when every planned question is present
 *   and has passed the full review pipeline (reviewStatus VERIFIED).
 * - Official PYQs are always servable (their verification badge is shown).
 * - A mock question is servable only when its whole mock is available, so a
 *   half-verified paper never leaks through the question API, practice,
 *   Today, search or "similar questions".
 * - An original practice question is servable only when it is VERIFIED.
 *
 * Pure and isomorphic: used by the content compiler and the server repository.
 */
import type { QuestionOrigin } from "./schema";

export interface GateQuestion {
  id: string;
  origin: QuestionOrigin;
  testId?: string;
  reviewStatus?: "DRAFT" | "SELF_CHECKED" | "VERIFIED" | "NEEDS_REVIEW";
}

export interface MockAvailability {
  missing: string[];
  verifiedCount: number;
  available: boolean;
}

export function mockAvailability(questionIds: string[], lookup: (id: string) => GateQuestion | undefined): MockAvailability {
  const qs = questionIds.map(lookup);
  const missing = questionIds.filter((_, i) => !qs[i]);
  const verifiedCount = qs.filter((q) => q?.reviewStatus === "VERIFIED").length;
  return { missing, verifiedCount, available: questionIds.length > 0 && missing.length === 0 && verifiedCount === questionIds.length };
}

export function isServable(q: GateQuestion, availableMocks: ReadonlySet<string>): boolean {
  switch (q.origin) {
    case "OFFICIAL_PYQ":
      return true;
    case "MOCK_TEST":
      return q.reviewStatus === "VERIFIED" && q.testId !== undefined && availableMocks.has(q.testId);
    case "ORIGINAL_PRACTICE":
      return q.reviewStatus === "VERIFIED";
    default:
      return false;
  }
}

export function servableIds(questions: GateQuestion[], mocks: { id: string; available: boolean }[]): Set<string> {
  const availableMocks = new Set(mocks.filter((m) => m.available).map((m) => m.id));
  return new Set(questions.filter((q) => isServable(q, availableMocks)).map((q) => q.id));
}
