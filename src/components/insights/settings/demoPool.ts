/**
 * The real questions demo data may reference (server-only): every official
 * PYQ, plus the questions of up to two AVAILABLE mock tests (fully verified).
 * Served on demand by /settings/demo-pool, so the settings page itself stays
 * small and mock answers are only sent when the student opts in.
 */
import "server-only";
import { getMockQuestions, getMocks, getPyqs, getQuestion, getTopic } from "@/lib/server/repo";
import type { CompiledQuestion } from "@/lib/content/types";
import type { DemoMock, DemoQuestion } from "@/lib/demo/seed";

/** How many available mocks the demo may simulate. */
export const DEMO_MOCK_LIMIT = 2;

export interface DemoMockChoice {
  id: string;
  number: number;
}

export interface DemoPool {
  pyqs: DemoQuestion[];
  mocks: (DemoMock & { questions: DemoQuestion[] })[];
}

function toDemo(q: CompiledQuestion, title: string): DemoQuestion {
  return {
    id: q.id,
    origin: q.origin === "MOCK_TEST" ? "MOCK_TEST" : "OFFICIAL_PYQ",
    subjectId: q.subjectId,
    topicId: q.topicId,
    topicName: getTopic(q.topicId)?.name ?? q.topicId,
    type: q.type,
    marks: q.marks,
    estimatedTimeSec: q.estimatedTimeSec,
    answer: q.answer,
    title,
    testId: q.testId,
    questionNumber: q.questionNumber,
  };
}

/** Available mocks the demo can simulate (lowest numbers first). */
export function demoMockChoice(): DemoMockChoice[] {
  return getMocks()
    .filter((m) => m.available)
    .sort((a, b) => a.number - b.number)
    .slice(0, DEMO_MOCK_LIMIT)
    .map((m) => ({ id: m.id, number: m.number }));
}

/** Official PYQs that pass the availability gate (all of them). */
export function demoPyqCount(): number {
  return getPyqs().filter((q) => getQuestion(q.id) !== undefined).length;
}

export function demoPool(includeMocks: boolean): DemoPool {
  const pyqs = getPyqs()
    .filter((q) => getQuestion(q.id) !== undefined)
    .map((q) => toDemo(q, `GATE DA ${q.year} · Q.${q.questionNumber}`));
  const mocks: DemoPool["mocks"] = [];
  if (includeMocks) {
    for (const choice of demoMockChoice()) {
      const m = getMocks().find((x) => x.id === choice.id)!;
      // getMockQuestions applies the availability gate: empty unless every question is verified.
      const qs = getMockQuestions(m.id);
      if (!qs.length || qs.length !== m.questionIds.length) continue;
      mocks.push({
        id: m.id,
        number: m.number,
        durationMinutes: m.durationMinutes,
        negativeMarking: m.negativeMarking,
        questionIds: m.questionIds,
        questions: qs.map((q, i) => toDemo(q, `Mock ${m.number} · Q.${q.questionNumber ?? i + 1}`)),
      });
    }
  }
  return { pyqs, mocks };
}
