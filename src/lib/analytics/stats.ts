/**
 * Learning analytics computed from the student's own attempts. None of these
 * figures are official GATE metrics; the UI labels them accordingly
 * ("Your topic mastery", "Platform-estimated").
 */
import type { AttemptRow, RevisionItemRow } from "@/lib/userdata/db";

export interface AccuracyStat {
  total: number; // attempts recorded (including unanswered/skipped)
  attempted: number; // correct + incorrect
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number | null;
  avgTimeMs: number | null;
}

type A = Pick<AttemptRow, "status" | "timeSpentMs">;

export function accuracyStat(rows: A[]): AccuracyStat {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let time = 0;
  let timed = 0;
  let total = 0;
  for (const r of rows) {
    if (r.status === "not_scored") continue;
    total++;
    if (r.status === "correct") correct++;
    else if (r.status === "incorrect") incorrect++;
    else skipped++;
    if (r.status !== "unanswered" && r.timeSpentMs > 0) {
      time += r.timeSpentMs;
      timed++;
    }
  }
  const attempted = correct + incorrect;
  return {
    total,
    attempted,
    correct,
    incorrect,
    skipped,
    accuracy: attempted ? correct / attempted : null,
    avgTimeMs: timed ? time / timed : null,
  };
}

/** Latest attempt per question (by createdAt). */
export function latestPerQuestion<T extends Pick<AttemptRow, "questionId" | "createdAt">>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const prev = m.get(r.questionId);
    if (!prev || prev.createdAt < r.createdAt) m.set(r.questionId, r);
  }
  return m;
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/** Wilson score interval lower bound (95%) for a proportion. */
export function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

export interface WeakTopic {
  topicId: string;
  attempted: number;
  correct: number;
  accuracy: number;
  wilsonLower: number;
}

/**
 * Weak topics: topics with at least `minAttempts` scored attempts whose
 * accuracy is below `threshold`, ranked by the Wilson lower bound (so a topic
 * with 1/5 correct ranks as weaker than one with 0/1).
 */
export function weakTopics(rows: Pick<AttemptRow, "topicId" | "status">[], opts: { minAttempts?: number; threshold?: number; limit?: number } = {}): WeakTopic[] {
  const { minAttempts = 3, threshold = 0.7, limit = 5 } = opts;
  const by = groupBy(rows.filter((r) => r.status === "correct" || r.status === "incorrect"), (r) => r.topicId);
  const out: WeakTopic[] = [];
  for (const [topicId, rs] of by) {
    const correct = rs.filter((r) => r.status === "correct").length;
    const n = rs.length;
    if (n < minAttempts) continue;
    const acc = correct / n;
    if (acc >= threshold) continue;
    out.push({ topicId, attempted: n, correct, accuracy: acc, wilsonLower: wilsonLower(correct, n) });
  }
  return out.sort((a, b) => a.wilsonLower - b.wilsonLower || a.accuracy - b.accuracy).slice(0, limit);
}

export interface MasteryInput {
  attempts: Pick<AttemptRow, "status" | "createdAt" | "origin" | "questionId">[];
  /** Number of official PYQs in the topic, and how many distinct ones were attempted. */
  pyqTotal: number;
  revisionItems: Pick<RevisionItemRow, "nextReview" | "confidence">[];
  now: Date;
}

export interface Mastery {
  score: number | null; // 0–100, null when there is not enough evidence
  level: "Not enough data" | "Needs work" | "Developing" | "Proficient" | "Strong";
  components: { recentAccuracy: number | null; pyqCoverage: number | null; revisionHealth: number | null };
  evidence: number;
}

export const MASTERY_HALF_LIFE_DAYS = 30;
export const MASTERY_MIN_ATTEMPTS = 3;

/**
 * Your topic mastery (0–100) =
 *   60% × recency-weighted accuracy (half-life 30 days)
 * + 25% × PYQ coverage (share of the topic's official PYQs attempted; if the
 *         topic has no PYQs this weight moves to accuracy)
 * + 15% × revision health (share of the topic's revision items that are not
 *         overdue and were last graded "almost" or "got it"; if there are no
 *         revision items this weight moves to accuracy)
 * Requires at least 3 scored attempts; otherwise "Not enough data".
 */
export function topicMastery(input: MasteryInput): Mastery {
  const scored = input.attempts.filter((a) => a.status === "correct" || a.status === "incorrect");
  const evidence = scored.length;
  let wSum = 0;
  let wCorrect = 0;
  for (const a of scored) {
    const age = Math.max(0, (input.now.getTime() - new Date(a.createdAt).getTime()) / 86_400_000);
    const w = Math.pow(0.5, age / MASTERY_HALF_LIFE_DAYS);
    wSum += w;
    if (a.status === "correct") wCorrect += w;
  }
  const recentAccuracy = wSum > 0 ? wCorrect / wSum : null;
  const pyqAttempted = new Set(scored.filter((a) => a.origin === "OFFICIAL_PYQ").map((a) => a.questionId)).size;
  const pyqCoverage = input.pyqTotal > 0 ? Math.min(1, pyqAttempted / input.pyqTotal) : null;
  const today = input.now.toISOString().slice(0, 10);
  const revisionHealth = input.revisionItems.length
    ? input.revisionItems.filter((r) => r.nextReview >= today && (r.confidence === "almost" || r.confidence === "got_it")).length /
      input.revisionItems.length
    : null;

  if (evidence < MASTERY_MIN_ATTEMPTS || recentAccuracy === null) {
    return { score: null, level: "Not enough data", components: { recentAccuracy, pyqCoverage, revisionHealth }, evidence };
  }
  let wAcc = 0.6;
  let total = 0;
  if (pyqCoverage !== null) total += 0.25 * pyqCoverage;
  else wAcc += 0.25;
  if (revisionHealth !== null) total += 0.15 * revisionHealth;
  else wAcc += 0.15;
  total += wAcc * recentAccuracy;
  const score = Math.round(total * 100);
  return { score, level: masteryLevel(score), components: { recentAccuracy, pyqCoverage, revisionHealth }, evidence };
}

export function masteryLevel(score: number): Mastery["level"] {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Proficient";
  if (score >= 40) return "Developing";
  return "Needs work";
}

/** Consecutive study days ending today (or yesterday, if nothing yet today). */
export function studyStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  const prev = (d: string) => {
    const x = new Date(`${d}T12:00:00`);
    x.setDate(x.getDate() - 1);
    return x.toISOString().slice(0, 10);
  };
  let cursor = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = prev(cursor);
  }
  return n;
}

/** Daily/weekly series of accuracy for trend charts. */
export function accuracyTrend(rows: Pick<AttemptRow, "status" | "day">[], bucket: "day" | "week" = "day") {
  const keyOf = (day: string) => {
    if (bucket === "day") return day;
    const d = new Date(`${day}T12:00:00`);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const by = groupBy(rows.filter((r) => r.status === "correct" || r.status === "incorrect"), (r) => keyOf(r.day));
  return [...by.entries()]
    .map(([period, rs]) => ({ period, attempted: rs.length, accuracy: rs.filter((r) => r.status === "correct").length / rs.length }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
