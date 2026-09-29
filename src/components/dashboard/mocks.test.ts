import { describe, expect, it } from "vitest";
import type { MockAttemptRow } from "@/lib/userdata/db";
import { mockAttemptLabels, mockProgress, type MockInfo } from "./mocks";
import { labelIndices } from "./TrendLine";

const mock = (n: number, tier: MockInfo["tier"], available = true): MockInfo => ({
  id: `mock-${String(n).padStart(2, "0")}`,
  number: n,
  tier,
  shortTitle: `Test ${n}`,
  available,
  durationMinutes: 30,
});

const MOCKS: MockInfo[] = [mock(1, "FOUNDATION"), mock(2, "FOUNDATION"), mock(3, "FOUNDATION", false), mock(11, "BEGINNER_INTERMEDIATE")];

function row(p: Partial<MockAttemptRow> & Pick<MockAttemptRow, "id" | "testId" | "status" | "startedAt">): MockAttemptRow {
  return { durationMs: 1_800_000, remainingMs: 0, currentIndex: 0, questions: {}, ...p };
}
const result = (score: number, maxScore = 25): MockAttemptRow["result"] => ({ score, maxScore, correct: 0, incorrect: 0, unanswered: 0, attempted: 0, accuracy: null, timeUsedMs: 0 });

describe("mockProgress", () => {
  it("has honest zeros and the first available mock as next when nothing is taken", () => {
    const mp = mockProgress(MOCKS, []);
    expect(mp).toMatchObject({ taken: 0, totalMocks: 4, availableCount: 3, submittedAttempts: 0, avgRatio: null, inProgress: null });
    expect(mp.next?.id).toBe("mock-01");
    expect(mp.series).toEqual([]);
  });

  it("counts distinct submitted mocks, averages score/max over attempts and orders the series by submission", () => {
    const rows = [
      row({ id: "b", testId: "mock-01", status: "submitted", startedAt: "2026-09-10T10:00:00Z", submittedAt: "2026-09-10T10:30:00Z", result: result(20) }),
      row({ id: "a", testId: "mock-01", status: "submitted", startedAt: "2026-09-01T10:00:00Z", submittedAt: "2026-09-01T10:30:00Z", result: result(10) }),
      row({ id: "c", testId: "mock-02", status: "submitted", startedAt: "2026-09-05T10:00:00Z", submittedAt: "2026-09-05T10:30:00Z", result: result(-2.5) }),
    ];
    const mp = mockProgress(MOCKS, rows);
    expect(mp.taken).toBe(2);
    expect(mp.submittedAttempts).toBe(3);
    expect(mp.series.map((p) => p.attemptId)).toEqual(["a", "c", "b"]);
    expect(mp.avgRatio).toBeCloseTo((0.4 - 0.1 + 0.8) / 3, 10);
    // mock-03 is not available, so the next one to take is mock-11.
    expect(mp.next?.id).toBe("mock-11");
    expect(mp.perTier).toEqual([
      { tier: "FOUNDATION", total: 3, taken: 2 },
      { tier: "BEGINNER_INTERMEDIATE", total: 1, taken: 0 },
    ]);
  });

  it("ignores submitted rows without a result, reports the latest in-progress attempt and never suggests it as next", () => {
    const rows = [
      row({ id: "x", testId: "mock-01", status: "submitted", startedAt: "2026-09-01T10:00:00Z" }),
      row({ id: "old", testId: "mock-02", status: "in_progress", startedAt: "2026-09-02T10:00:00Z", remainingMs: 5000 }),
      row({ id: "new", testId: "mock-01", status: "in_progress", startedAt: "2026-09-03T10:00:00Z", remainingMs: 9000 }),
    ];
    const mp = mockProgress(MOCKS, rows);
    expect(mp.taken).toBe(0);
    expect(mp.inProgress).toMatchObject({ id: "mock-01", attemptId: "new", remainingMs: 9000 });
    expect(mp.next?.id).toBe("mock-02");
  });
});

describe("mockAttemptLabels", () => {
  it("marks retakes of the same mock", () => {
    const labels = mockAttemptLabels([
      { testId: "mock-01", number: 1 },
      { testId: "mock-02", number: 2 },
      { testId: "mock-01", number: 1 },
      { testId: "mock-01", number: 1 },
    ]);
    expect(labels.map((l) => l.short)).toEqual(["M1", "M2", "M1 (2nd)", "M1 (3rd)"]);
    expect(labels[2].long).toBe("Mock 1, 2nd attempt");
  });
});

describe("labelIndices", () => {
  it("labels every point when there are few", () => {
    expect(labelIndices(1)).toEqual([0]);
    expect(labelIndices(5)).toEqual([0, 1, 2, 3, 4]);
  });
  it("thins long series but always keeps the first and last, without crowding the last", () => {
    const idx = labelIndices(60);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(59);
    expect(idx.length).toBeLessThanOrEqual(6);
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(9);
    expect(labelIndices(6)).toEqual([0, 2, 5]);
  });
});
