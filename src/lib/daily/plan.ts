/**
 * Today's GATE DA: a deterministic daily study plan.
 *
 * The plan is generated on the client from the date (seeded PRNG) and from
 * the student's state AS OF THE START OF THE DAY (attempts before today,
 * revision due today), so it stays identical all day: answering a question
 * marks it done instead of replacing it.
 *
 * Contents:
 *  - N questions (default 10) from official PYQs and original practice
 *    questions. Mock-test questions are never used, so no mock is spoiled.
 *    Unattempted and previously-incorrect questions are preferred, with a
 *    quota for weak topics (~40%) and topics with revision due (~20%), and
 *    caps per topic and per subject so the set stays varied.
 *  - 1 weak-topic exercise: 5 questions from the weakest topic, or from a
 *    suggested topic (high historical PYQ weight, least practised) if there
 *    is not enough data for a weak topic yet.
 *  - 1 concept (rotates through the library; prefers a weak topic).
 *  - 5 formulas (weak topics and today's topics first, then the rotation).
 *  - 1 revision set: up to 10 items due today.
 *
 * Pure: no I/O, no clock. Pass `day` as a local "YYYY-MM-DD".
 */
import { DIFFICULTY_ORDER } from "@/lib/labels";
import { localDay, type AttemptRow, type RevisionItemRow } from "@/lib/userdata/db";
import { weakTopics } from "@/lib/analytics/stats";
import { historyState, questionHistory, type PoolQuestion, type QuestionHistory } from "@/lib/practice/pool";
import { canonicalOrder } from "@/lib/practice/select";
import { includedSubjects, type DailyConfig } from "./config";
import { dayNumber, hashString, rngFrom, shuffle, weightedSample } from "./random";

export { hashString, mulberry32, rngFrom, shuffle, weightedSample, dayNumber } from "./random";

export interface PlanConcept {
  id: string;
  subjectId: string;
  topicId: string;
}
export type PlanFormula = PlanConcept;

export interface PlanRevisionItem {
  key: string;
  nextReview: string;
  topicId?: string;
}

export interface DailyPlanInput {
  /** Local date "YYYY-MM-DD"; the only source of randomness. */
  day: string;
  /** PYQ + original-practice metadata. Mock questions are ignored if present. */
  pool: readonly PoolQuestion[];
  /** Per-question history from attempts made BEFORE `day`. */
  history: ReadonlyMap<string, QuestionHistory>;
  /** Weak topics (weakest first) from attempts made before `day`. */
  weakTopicIds: readonly string[];
  /** Revision items that were due at the start of `day`. */
  dueRevision: readonly PlanRevisionItem[];
  concepts: readonly PlanConcept[];
  formulas: readonly PlanFormula[];
  /** Historical weight per topic (official PYQ marks), used to suggest a topic when there is no weak topic. */
  topicWeights: ReadonlyMap<string, number>;
  /** Syllabus order of topics (for stable ordering). */
  topicOrder?: ReadonlyMap<string, number>;
  config: DailyConfig;
  /** The DA subject ids (every subject except General Aptitude). */
  daSubjectIds: readonly string[];
}

export type QuestionReason = "weak" | "revision" | "new" | "retry" | "review";

export const QUESTION_REASON_LABEL: Record<QuestionReason, string> = {
  weak: "Weak topic",
  revision: "Revision due in topic",
  new: "Not attempted yet",
  retry: "Wrong last time",
  review: "Review",
};

export interface DailyPlan {
  day: string;
  /** Questions requested by the settings. */
  requested: number;
  questionIds: string[];
  reasons: Record<string, QuestionReason>;
  weakExercise: { topicId: string; basis: "weakest" | "suggested"; questionIds: string[] } | null;
  conceptId: string | null;
  formulaIds: string[];
  /** Up to 10 revision keys, most overdue first. */
  revisionKeys: string[];
  /** Subject ids the plan drew from. */
  subjects: string[];
}

export const WEAK_EXERCISE_SIZE = 5;
export const DAILY_FORMULAS = 5;
export const DAILY_REVISION_MAX = 10;

const STATUS_WEIGHT = { unattempted: 4, incorrect: 3, other: 1, correct: 0.5 } as const;

function reasonFor(h: QuestionHistory | undefined): QuestionReason {
  const s = historyState(h);
  return s === "unattempted" ? "new" : s === "incorrect" ? "retry" : "review";
}

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const { day, config, history } = input;
  const rand = rngFrom(`gate-da-daily:${day}`);
  const dayIdx = dayNumber(day);
  const included = includedSubjects(config, input.daSubjectIds);
  const subjectOf = new Map<string, string>();

  // Questions already in today's revision set are reviewed there, not repeated here.
  const revisionQuestionIds = new Set(input.dueRevision.filter((r) => r.key.startsWith("question:")).map((r) => r.key.slice("question:".length)));
  const candidates = input.pool
    .filter((q) => q.origin !== "MOCK_TEST" && included.has(q.subjectId) && !revisionQuestionIds.has(q.id))
    .sort(canonicalOrder(input.topicOrder));
  for (const q of candidates) subjectOf.set(q.topicId, q.subjectId);
  const topicsWithQuestions = new Set(candidates.map((q) => q.topicId));

  const weak = input.weakTopicIds.filter((t) => topicsWithQuestions.has(t));
  const weakRank = new Map(weak.map((t, i) => [t, i]));
  const revisionTopics = new Set(input.dueRevision.map((r) => r.topicId).filter((t): t is string => !!t && topicsWithQuestions.has(t)));
  const statusWeight = (q: PoolQuestion) => STATUS_WEIGHT[historyState(history.get(q.id))];

  // ---------------------------------------------------------------- weak-topic exercise (first, so the main set does not overlap it)
  let weakExercise: DailyPlan["weakExercise"] = null;
  const exerciseTopic = weak[0] ?? suggestTopic(candidates, history, input.topicWeights, dayIdx);
  if (exerciseTopic) {
    const inTopic = candidates.filter((q) => q.topicId === exerciseTopic);
    const picked = weightedSample(inTopic, WEAK_EXERCISE_SIZE, (q) => (historyState(history.get(q.id)) === "correct" ? 0.6 : 3), rand);
    const order = canonicalOrder(input.topicOrder);
    picked.sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty) || order(a, b));
    weakExercise = { topicId: exerciseTopic, basis: weak[0] ? "weakest" : "suggested", questionIds: picked.map((q) => q.id) };
  }
  const exerciseIds = new Set(weakExercise?.questionIds ?? []);

  // ---------------------------------------------------------------- main question set
  const count = config.count;
  const main = candidates.filter((q) => !exerciseIds.has(q.id));
  const chosen: PoolQuestion[] = [];
  const reasons: Record<string, QuestionReason> = {};
  const perTopic = new Map<string, number>();
  const perSubject = new Map<string, number>();
  const subjectsInPlay = new Set(main.map((q) => q.subjectId)).size || 1;
  const topicCap = Math.max(2, Math.ceil(count * 0.3));
  const subjectCap = Math.max(3, Math.ceil(count / subjectsInPlay) + 1);

  const draw = (pool: PoolQuestion[], n: number, weight: (q: PoolQuestion) => number, reason: (q: PoolQuestion) => QuestionReason, capped: boolean) => {
    if (n <= 0) return;
    const taken = new Set(chosen.map((q) => q.id));
    const ordered = weightedSample(
      pool.filter((q) => !taken.has(q.id)),
      pool.length,
      weight,
      rand,
    );
    let added = 0;
    for (const q of ordered) {
      if (added >= n) break;
      if (capped && ((perTopic.get(q.topicId) ?? 0) >= topicCap || (perSubject.get(q.subjectId) ?? 0) >= subjectCap)) continue;
      chosen.push(q);
      reasons[q.id] = reason(q);
      perTopic.set(q.topicId, (perTopic.get(q.topicId) ?? 0) + 1);
      perSubject.set(q.subjectId, (perSubject.get(q.subjectId) ?? 0) + 1);
      added++;
    }
  };

  const weakQuota = weak.length ? Math.round(count * 0.4) : 0;
  const revisionQuota = revisionTopics.size ? Math.round(count * 0.2) : 0;
  draw(
    main.filter((q) => weakRank.has(q.topicId)),
    weakQuota,
    (q) => statusWeight(q) * (1 + (weak.length - (weakRank.get(q.topicId) ?? 0)) / weak.length),
    () => "weak",
    true,
  );
  draw(
    main.filter((q) => revisionTopics.has(q.topicId)),
    revisionQuota,
    statusWeight,
    () => "revision",
    true,
  );
  const generalWeight = (q: PoolQuestion) => statusWeight(q) * (weakRank.has(q.topicId) ? 1.5 : 1) * (revisionTopics.has(q.topicId) ? 1.3 : 1);
  const generalReason = (q: PoolQuestion) => reasonFor(history.get(q.id));
  draw(main, count - chosen.length, generalWeight, generalReason, true);
  // A small pool (e.g. one subject selected) can hit the caps: fill the rest without them.
  draw(main, count - chosen.length, generalWeight, generalReason, false);

  const questionIds = shuffle(
    chosen.map((q) => q.id),
    rand,
  );

  // ---------------------------------------------------------------- concept of the day
  const conceptPool = input.concepts.filter((c) => included.has(c.subjectId));
  let conceptId: string | null = null;
  const weakWithConcepts = input.weakTopicIds.find((t) => conceptPool.some((c) => c.topicId === t));
  if (weakWithConcepts) {
    const list = conceptPool.filter((c) => c.topicId === weakWithConcepts).sort((a, b) => a.id.localeCompare(b.id));
    conceptId = list[dayIdx % list.length].id;
  } else if (conceptPool.length) {
    // A fixed permutation walked one step per day: every concept comes up once before any repeats.
    const cycle = shuffle(
      [...conceptPool].sort((a, b) => a.id.localeCompare(b.id)),
      rngFrom("gate-da-concept-cycle"),
    );
    conceptId = cycle[dayIdx % cycle.length].id;
  }

  // ---------------------------------------------------------------- formulas
  const formulaPool = [...input.formulas.filter((f) => included.has(f.subjectId))].sort((a, b) => a.id.localeCompare(b.id));
  const formulaIds: string[] = [];
  const addFormulas = (list: readonly PlanFormula[], max: number) => {
    let n = 0;
    for (const f of list) {
      if (formulaIds.length >= DAILY_FORMULAS || n >= max) break;
      if (formulaIds.includes(f.id)) continue;
      formulaIds.push(f.id);
      n++;
    }
  };
  const weakSet = new Set(input.weakTopicIds);
  addFormulas(
    shuffle(
      formulaPool.filter((f) => weakSet.has(f.topicId)),
      rand,
    ),
    2,
  );
  const todaysTopics = new Set([...chosen.map((q) => q.topicId), ...(weakExercise ? [weakExercise.topicId] : [])]);
  addFormulas(
    shuffle(
      formulaPool.filter((f) => todaysTopics.has(f.topicId)),
      rand,
    ),
    2,
  );
  if (formulaPool.length) {
    const cycle = shuffle(formulaPool, rngFrom("gate-da-formula-cycle"));
    const start = (dayIdx * DAILY_FORMULAS) % cycle.length;
    addFormulas([...cycle.slice(start), ...cycle.slice(0, start)], DAILY_FORMULAS);
  }

  // ---------------------------------------------------------------- revision set
  const revisionKeys = [...input.dueRevision]
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.key.localeCompare(b.key))
    .slice(0, DAILY_REVISION_MAX)
    .map((r) => r.key);

  return {
    day,
    requested: count,
    questionIds,
    reasons,
    weakExercise,
    conceptId,
    formulaIds,
    revisionKeys,
    subjects: [...included],
  };
}

/**
 * A topic to strengthen when no weak topic is known yet: high historical PYQ
 * weight relative to how much the student has practised it, rotating daily
 * among the top five so the suggestion does not stall on one topic.
 */
export function suggestTopic(
  candidates: readonly PoolQuestion[],
  history: ReadonlyMap<string, QuestionHistory>,
  topicWeights: ReadonlyMap<string, number>,
  dayIdx: number,
): string | null {
  const answered = new Map<string, number>();
  const topics = new Set<string>();
  for (const q of candidates) {
    topics.add(q.topicId);
    const h = history.get(q.id);
    if (h?.answered) answered.set(q.topicId, (answered.get(q.topicId) ?? 0) + h.answered);
  }
  const ranked = [...topics]
    .map((t) => ({ t, score: (1 + (topicWeights.get(t) ?? 0)) / (1 + (answered.get(t) ?? 0)) }))
    .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t))
    .slice(0, 5);
  return ranked.length ? ranked[dayIdx % ranked.length].t : null;
}

// ------------------------------------------------------------------ inputs from user data

/** Attempts made before the given local day. */
export function attemptsBefore<T extends Pick<AttemptRow, "day">>(attempts: readonly T[], day: string): T[] {
  return attempts.filter((a) => a.day < day);
}

/** History and weak topics as of the start of `day`. */
export function stateAtStartOfDay(attempts: readonly Pick<AttemptRow, "questionId" | "status" | "createdAt" | "day" | "topicId">[], day: string) {
  const before = attemptsBefore(attempts, day);
  return {
    history: questionHistory(before),
    weakTopicIds: weakTopics(before, { limit: 10 }).map((w) => w.topicId),
  };
}

/**
 * Revision items that were due at the start of `day`: due now, or already
 * reviewed today (a review moves `nextReview` into the future, but the item
 * still belongs to today's set).
 */
export function dueAtStartOfDay<T extends Pick<RevisionItemRow, "nextReview" | "lastReviewed">>(items: readonly T[], day: string): T[] {
  return items.filter((r) => r.nextReview <= day || (r.lastReviewed !== null && localDay(new Date(r.lastReviewed)) === day));
}

/** A stable signature of the plan's settings (used to key per-plan UI state). */
export function planSignature(day: string, config: DailyConfig): string {
  return `${day}:${config.count}:${config.includeGA ? 1 : 0}:${config.subjects ? [...config.subjects].sort().join(",") : "all"}:${hashString(day)}`;
}
