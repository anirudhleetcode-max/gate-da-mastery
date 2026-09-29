/**
 * Mock-test progress derived from the student's mock attempts (client-side).
 * Only submitted attempts with a result count toward scores and completion.
 */
import type { MockTier } from "@/lib/content/schema";
import { localDay, type MockAttemptRow } from "@/lib/userdata/db";
import { TIER_ORDER } from "@/lib/mock/structure";

/** Serialisable mock summary passed from the server. */
export interface MockInfo {
  id: string;
  number: number;
  tier: MockTier;
  shortTitle: string;
  available: boolean;
  durationMinutes: number;
}

export interface MockScorePoint {
  attemptId: string;
  testId: string;
  number: number;
  day: string;
  score: number;
  maxScore: number;
  /** score / maxScore (can be negative with negative marking). */
  ratio: number;
}

export interface MockProgress {
  /** Distinct mocks with at least one submitted attempt. */
  taken: number;
  totalMocks: number;
  /** Mocks whose paper is complete and open to take now. */
  availableCount: number;
  submittedAttempts: number;
  /** Mean of score / max over submitted attempts, or null. */
  avgRatio: number | null;
  series: MockScorePoint[];
  inProgress: (MockInfo & { attemptId: string; remainingMs: number }) | null;
  /** First available mock (by number) not yet submitted or in progress. */
  next: MockInfo | null;
  perTier: { tier: MockTier; total: number; taken: number }[];
  takenIds: Set<string>;
}

export function mockProgress(mocks: readonly MockInfo[], rows: readonly MockAttemptRow[]): MockProgress {
  const byId = new Map(mocks.map((m) => [m.id, m]));
  const submitted = rows.filter((r) => r.status === "submitted" && r.result && r.result.maxScore > 0);
  const takenIds = new Set(submitted.map((r) => r.testId));
  const series: MockScorePoint[] = submitted
    .map((r) => ({
      attemptId: r.id,
      testId: r.testId,
      number: byId.get(r.testId)?.number ?? Number(r.testId.replace(/^mock-/, "")),
      day: localDay(new Date(r.submittedAt ?? r.startedAt)),
      at: r.submittedAt ?? r.startedAt,
      score: r.result!.score,
      maxScore: r.result!.maxScore,
      ratio: r.result!.score / r.result!.maxScore,
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ at: _at, ...p }) => {
      void _at;
      return p;
    });
  const open = rows.filter((r) => r.status === "in_progress" && byId.has(r.testId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const inProgress = open ? { ...byId.get(open.testId)!, attemptId: open.id, remainingMs: open.remainingMs } : null;
  const sorted = [...mocks].sort((a, b) => a.number - b.number);
  const next = sorted.find((m) => m.available && !takenIds.has(m.id) && m.id !== open?.testId) ?? null;
  return {
    taken: takenIds.size,
    totalMocks: mocks.length,
    availableCount: mocks.filter((m) => m.available).length,
    submittedAttempts: series.length,
    avgRatio: series.length ? series.reduce((a, p) => a + p.ratio, 0) / series.length : null,
    series,
    inProgress,
    next,
    perTier: TIER_ORDER.map((tier) => {
      const inTier = mocks.filter((m) => m.tier === tier);
      return { tier, total: inTier.length, taken: inTier.filter((m) => takenIds.has(m.id)).length };
    }).filter((t) => t.total > 0),
    takenIds,
  };
}

const ORDINAL = ["", "", "2nd", "3rd"];
const ordinal = (k: number) => ORDINAL[k] ?? `${k}th`;

/** Chart labels for mock attempts: "M4", and "M4 (2nd)" for a retake of the same mock. */
export function mockAttemptLabels(series: readonly Pick<MockScorePoint, "testId" | "number">[]): { short: string; long: string }[] {
  const seen = new Map<string, number>();
  return series.map((p) => {
    const k = (seen.get(p.testId) ?? 0) + 1;
    seen.set(p.testId, k);
    return k === 1 ? { short: `M${p.number}`, long: `Mock ${p.number}` } : { short: `M${p.number} (${ordinal(k)})`, long: `Mock ${p.number}, ${ordinal(k)} attempt` };
  });
}
