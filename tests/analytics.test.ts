import { describe, expect, it } from "vitest";
import { accuracyStat, accuracyTrend, latestPerQuestion, masteryLevel, studyStreak, topicMastery, weakTopics, wilsonLower } from "@/lib/analytics/stats";

type S = "correct" | "incorrect" | "unanswered" | "not_scored";
const row = (status: S, extra: Record<string, unknown> = {}) => ({ status, timeSpentMs: 60000, topicId: "t1", questionId: "q", createdAt: "2026-10-01T10:00:00Z", origin: "OFFICIAL_PYQ" as const, day: "2026-10-01", ...extra });

describe("accuracy", () => {
  it("counts attempted = correct + incorrect and ignores not-scored", () => {
    const s = accuracyStat([row("correct"), row("incorrect"), row("unanswered"), row("not_scored")]);
    expect(s).toMatchObject({ total: 3, attempted: 2, correct: 1, incorrect: 1, skipped: 1, accuracy: 0.5 });
    expect(s.avgTimeMs).toBe(60000);
  });
  it("returns null accuracy with no attempts", () => {
    expect(accuracyStat([]).accuracy).toBeNull();
  });
  it("latest attempt per question", () => {
    const m = latestPerQuestion([row("incorrect", { questionId: "a", createdAt: "2026-01-01" }), row("correct", { questionId: "a", createdAt: "2026-02-01" })]);
    expect(m.get("a")?.status).toBe("correct");
  });
});

describe("weak topics", () => {
  it("uses the Wilson lower bound and a minimum attempt count", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row(i === 0 ? "correct" : "incorrect", { topicId: "weak" })),
      row("incorrect", { topicId: "tiny" }),
      ...Array.from({ length: 6 }, () => row("correct", { topicId: "strong" })),
    ];
    const w = weakTopics(rows);
    expect(w.map((x) => x.topicId)).toEqual(["weak"]);
    expect(w[0].accuracy).toBeCloseTo(0.2);
    expect(wilsonLower(1, 5)).toBeLessThan(0.2);
    expect(wilsonLower(0, 0)).toBe(0);
  });
});

describe("topic mastery", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  it("requires at least 3 scored attempts", () => {
    expect(topicMastery({ attempts: [row("correct")], pyqTotal: 4, revisionItems: [], now }).level).toBe("Not enough data");
  });
  it("combines recency-weighted accuracy, PYQ coverage and revision health", () => {
    const attempts = [row("correct", { questionId: "p1" }), row("correct", { questionId: "p2" }), row("incorrect", { questionId: "p3" }), row("correct", { questionId: "p4" })];
    const m = topicMastery({ attempts, pyqTotal: 4, revisionItems: [{ nextReview: "2026-10-20", confidence: "got_it" }], now });
    expect(m.components.pyqCoverage).toBe(1);
    expect(m.components.revisionHealth).toBe(1);
    expect(m.components.recentAccuracy).toBeCloseTo(0.75, 5);
    expect(m.score).toBe(Math.round((0.6 * 0.75 + 0.25 + 0.15) * 100));
  });
  it("weights recent attempts more than old ones", () => {
    const oldWrong = Array.from({ length: 3 }, (_, i) => row("incorrect", { questionId: `o${i}`, createdAt: "2026-06-01T00:00:00Z" }));
    const newRight = Array.from({ length: 3 }, (_, i) => row("correct", { questionId: `n${i}`, createdAt: "2026-10-09T00:00:00Z" }));
    const m = topicMastery({ attempts: [...oldWrong, ...newRight], pyqTotal: 0, revisionItems: [], now });
    expect(m.components.recentAccuracy!).toBeGreaterThan(0.9);
  });
  it("maps levels", () => {
    expect([masteryLevel(90), masteryLevel(75), masteryLevel(50), masteryLevel(10)]).toEqual(["Strong", "Proficient", "Developing", "Needs work"]);
  });
});

describe("streak and trends", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(studyStreak(["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3);
    expect(studyStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2);
    expect(studyStreak(["2026-10-07"], "2026-10-10")).toBe(0);
  });
  it("buckets accuracy by day and week", () => {
    const rows = [row("correct", { day: "2026-10-05" }), row("incorrect", { day: "2026-10-05" }), row("correct", { day: "2026-10-06" })];
    expect(accuracyTrend(rows, "day")).toEqual([
      { period: "2026-10-05", attempted: 2, accuracy: 0.5 },
      { period: "2026-10-06", attempted: 1, accuracy: 1 },
    ]);
    expect(accuracyTrend(rows, "week")).toHaveLength(1);
  });
});
