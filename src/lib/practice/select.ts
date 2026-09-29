/**
 * Practice Now: filtering and seeded selection of a practice set.
 * Pure and deterministic for a given seed, so it is unit-testable.
 *
 * Integrity rule: a mock-test question is only eligible once the student has
 * submitted that mock (otherwise practising it would spoil the mock).
 */
import type { Difficulty, SubjectId } from "@/lib/content/schema";
import { DIFFICULTY_ORDER, SUBJECT_ORDER } from "@/lib/labels";
import { rngFrom, shuffle as shuffleWith } from "@/lib/daily/random";
import { historyState, type PoolQuestion, type QuestionHistory } from "./pool";

export const PRACTICE_COUNTS = [5, 10, 20, 30, 50] as const;
export type PracticeCount = (typeof PRACTICE_COUNTS)[number];

export type PracticeSource = "pyq" | "original" | "both";
export type PracticeStatus = "all" | "unattempted" | "incorrect";

export interface PracticeFilters {
  count: PracticeCount;
  /** "" = all subjects. */
  subjectId: string;
  /** "" = all topics of the subject. */
  topicId: string;
  /** Empty = any difficulty. */
  difficulties: Difficulty[];
  source: PracticeSource;
  status: PracticeStatus;
  timed: boolean;
  shuffle: boolean;
}

export const DEFAULT_PRACTICE_FILTERS: PracticeFilters = {
  count: 10,
  subjectId: "",
  topicId: "",
  difficulties: [],
  source: "both",
  status: "all",
  timed: false,
  shuffle: true,
};

/** Seconds a question takes when it has no estimate (never expected; defensive). */
export const FALLBACK_QUESTION_SEC = 180;

/** Drop mock questions whose mock the student has not submitted. */
export function eligiblePool(pool: readonly PoolQuestion[], submittedMocks: ReadonlySet<string>): PoolQuestion[] {
  return pool.filter((q) => q.origin !== "MOCK_TEST" || (q.testId !== undefined && submittedMocks.has(q.testId)));
}

function sourceMatches(q: PoolQuestion, source: PracticeSource): boolean {
  if (source === "both") return true;
  if (source === "pyq") return q.origin === "OFFICIAL_PYQ";
  return q.origin === "ORIGINAL_PRACTICE" || q.origin === "MOCK_TEST";
}

function statusMatches(h: QuestionHistory | undefined, status: PracticeStatus): boolean {
  if (status === "all") return true;
  const s = historyState(h);
  return status === "unattempted" ? s === "unattempted" : s === "incorrect";
}

/** All questions of the (already eligible) pool that match the filters, in canonical order. */
export function matchPractice(
  pool: readonly PoolQuestion[],
  f: Pick<PracticeFilters, "subjectId" | "topicId" | "difficulties" | "source" | "status">,
  history: ReadonlyMap<string, QuestionHistory>,
  topicOrder?: ReadonlyMap<string, number>,
): PoolQuestion[] {
  const diffs = new Set(f.difficulties);
  return pool
    .filter(
      (q) =>
        (!f.subjectId || q.subjectId === f.subjectId) &&
        (!f.topicId || q.topicId === f.topicId) &&
        (diffs.size === 0 || diffs.has(q.difficulty)) &&
        sourceMatches(q, f.source) &&
        statusMatches(history.get(q.id), f.status),
    )
    .sort(canonicalOrder(topicOrder));
}

const ORIGIN_RANK = { OFFICIAL_PYQ: 0, ORIGINAL_PRACTICE: 1, MOCK_TEST: 2 } as const;

/** Subject (syllabus order) → topic → PYQs (newest first, by question number) → practice → mock. */
export function canonicalOrder(topicOrder?: ReadonlyMap<string, number>) {
  const subj = (s: SubjectId) => {
    const i = SUBJECT_ORDER.indexOf(s);
    return i < 0 ? 99 : i;
  };
  return (a: PoolQuestion, b: PoolQuestion) =>
    subj(a.subjectId) - subj(b.subjectId) ||
    (topicOrder ? (topicOrder.get(a.topicId) ?? 999) - (topicOrder.get(b.topicId) ?? 999) : 0) ||
    a.topicId.localeCompare(b.topicId) ||
    ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] ||
    (b.year ?? 0) - (a.year ?? 0) ||
    (a.questionNumber ?? 0) - (b.questionNumber ?? 0) ||
    a.id.localeCompare(b.id);
}

/** Time limit for a timed set: the sum of the questions' estimated times, rounded up to a whole minute. */
export function timeLimitSec(questions: readonly Pick<PoolQuestion, "estimatedTimeSec">[]): number {
  const total = questions.reduce((a, q) => a + (q.estimatedTimeSec > 0 ? q.estimatedTimeSec : FALLBACK_QUESTION_SEC), 0);
  return Math.ceil(total / 60) * 60;
}

export interface PracticeSelection {
  ids: string[];
  /** Questions that matched the filters. */
  matched: number;
  requested: number;
  /** Seconds for a timed set, otherwise null. */
  timeLimitSec: number | null;
}

/**
 * Choose the practice set. When more questions match than requested, a
 * uniform seeded sample is drawn; the set is then shuffled (seeded) or kept
 * in canonical order.
 */
export function selectPractice(
  pool: readonly PoolQuestion[],
  f: PracticeFilters,
  history: ReadonlyMap<string, QuestionHistory>,
  seed: number | string,
  topicOrder?: ReadonlyMap<string, number>,
): PracticeSelection {
  const matched = matchPractice(pool, f, history, topicOrder);
  const rand = rngFrom(seed);
  let chosen = matched.length > f.count ? shuffleWith(matched, rand).slice(0, f.count) : matched;
  chosen = f.shuffle ? shuffleWith(chosen, rand) : [...chosen].sort(canonicalOrder(topicOrder));
  return { ids: chosen.map((q) => q.id), matched: matched.length, requested: f.count, timeLimitSec: f.timed ? timeLimitSec(chosen) : null };
}

/** An explicit list of ids (from ?ids=): keep known, eligible ones in the given order; optionally shuffle. */
export function resolveExplicitIds(
  ids: readonly string[],
  pool: readonly PoolQuestion[],
  submittedMocks: ReadonlySet<string>,
): { questions: PoolQuestion[]; unknown: string[]; locked: string[] } {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const questions: PoolQuestion[] = [];
  const unknown: string[] = [];
  const locked: string[] = [];
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) unknown.push(id);
    else if (q.origin === "MOCK_TEST" && !(q.testId && submittedMocks.has(q.testId))) locked.push(id);
    else questions.push(q);
  }
  return { questions, unknown, locked };
}

// ------------------------------------------------------------------ query parameters

export const MAX_EXPLICIT_IDS = 100;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Closest allowed count (ties go to the larger count). */
export function nearestCount(n: number): PracticeCount {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PRACTICE_FILTERS.count;
  let best: PracticeCount = PRACTICE_COUNTS[0];
  for (const c of PRACTICE_COUNTS) if (Math.abs(c - n) <= Math.abs(best - n)) best = c;
  return best;
}

/**
 * Parse `?subject=&topic=&count=&ids=` (plus optional `difficulty=EASY,HARD`,
 * `source=`, `status=`, `timed=1`) from links on other pages. Unknown values
 * fall back to the defaults; a topic implies its subject.
 */
export function parsePracticeQuery(
  sp: SearchParams,
  ctx: { subjectIds: ReadonlySet<string>; topicSubject: ReadonlyMap<string, string> },
): { filters: PracticeFilters; ids: string[] | null } {
  const f: PracticeFilters = { ...DEFAULT_PRACTICE_FILTERS, difficulties: [] };
  const subject = first(sp.subject);
  const topic = first(sp.topic);
  if (topic && ctx.topicSubject.has(topic)) {
    f.topicId = topic;
    f.subjectId = ctx.topicSubject.get(topic)!;
  } else if (subject && ctx.subjectIds.has(subject)) {
    f.subjectId = subject;
  }
  const count = first(sp.count);
  if (count) f.count = nearestCount(Number(count));
  const diff = first(sp.difficulty);
  if (diff) f.difficulties = DIFFICULTY_ORDER.filter((d) => diff.split(",").includes(d));
  const source = first(sp.source);
  if (source === "pyq" || source === "original" || source === "both") f.source = source;
  const status = first(sp.status);
  if (status === "all" || status === "unattempted" || status === "incorrect") f.status = status;
  if (first(sp.timed) === "1") f.timed = true;
  const rawIds = first(sp.ids);
  const ids = rawIds
    ? [...new Set(rawIds.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_EXPLICIT_IDS)
    : null;
  return { filters: f, ids: ids && ids.length ? ids : null };
}
