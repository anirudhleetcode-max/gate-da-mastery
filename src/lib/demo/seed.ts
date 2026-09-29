/**
 * Demo data: a deterministic generator plus a writer that can ONLY write to
 * the separate demo database ("gate-da-demo").
 *
 * Rules:
 *  - Every question id in the output comes from the list the caller passes
 *    in (real ids chosen on the server: official PYQs and questions of mocks
 *    that are available). Nothing is invented.
 *  - The generator is pure: the same input (questions, mocks, seed, now)
 *    always produces the same rows, so it can be unit-tested.
 *  - Responses are consistent with the answer key: a "correct" attempt
 *    stores the correct response, and statuses and marks come from the real
 *    scoring rules (`scoreQuestion`).
 *  - The writer refuses any database other than the demo database, so real
 *    user data can never be mixed with demo data.
 */
import type { Answer, OptionLabel, QuestionType, SubjectId } from "@/lib/content/schema";
import {
  DEMO_DB_NAME,
  MISTAKE_TYPES,
  localDay,
  type AttemptRow,
  type BookmarkRow,
  type ErrorLogRow,
  type GateDaDB,
  type MockAttemptRow,
  type MockQuestionState,
  type RevisionItemRow,
  type SettingRow,
} from "@/lib/userdata/db";
import { formatAnswer, formatResponse, scoreQuestion, scoreTest, type UserResponse } from "@/lib/scoring/score";
import { initialState, review, type RecallGrade, type RevisionState } from "@/lib/revision/schedule";
import { mulberry32, shuffle } from "@/lib/daily/random";

// ------------------------------------------------------------------ input / output

/** A real question the demo may reference (with its answer, so responses are consistent). */
export interface DemoQuestion {
  id: string;
  origin: "OFFICIAL_PYQ" | "MOCK_TEST";
  subjectId: SubjectId;
  topicId: string;
  topicName: string;
  type: QuestionType;
  marks: number;
  estimatedTimeSec: number;
  answer: Answer;
  /** Display title, identical to the app's ("GATE DA 2025 · Q.12", "Mock 7 · Q.3"). */
  title: string;
  testId?: string;
  questionNumber?: number;
}

/** A mock test that is available (every question verified). */
export interface DemoMock {
  id: string;
  number: number;
  durationMinutes: number;
  negativeMarking: boolean;
  questionIds: string[];
}

export interface DemoInput {
  questions: readonly DemoQuestion[];
  mocks?: readonly DemoMock[];
  seed: number;
  now: Date;
  /** Length of the simulated study history, in days (default 28). */
  days?: number;
}

export interface DemoData {
  attempts: AttemptRow[];
  mockAttempts: MockAttemptRow[];
  bookmarks: BookmarkRow[];
  revisionItems: RevisionItemRow[];
  errorLogs: ErrorLogRow[];
  settings: SettingRow[];
}

/** Settings key recording when and how the demo database was generated. */
export const DEMO_INFO_KEY = "demoInfo";

export interface DemoInfo {
  seed: number;
  generatedAt: string;
  pyqs: number;
  mocks: string[];
}

// ------------------------------------------------------------------ helpers

const LABELS: OptionLabel[] = ["A", "B", "C", "D"];

/** The response that the key marks correct (MTA: any option, it is not scored). */
export function correctResponse(type: QuestionType, answer: Answer, rand: () => number): UserResponse {
  switch (answer.kind) {
    case "MCQ":
      return { kind: "MCQ", choice: answer.correct };
    case "MSQ":
      return { kind: "MSQ", choices: [...answer.correct].sort() };
    case "NAT": {
      const mid = niceNumber(answer.min + (answer.max - answer.min) / 2);
      const v = Number(mid);
      // Rounding the midpoint of a very narrow range could leave it; fall back to the exact bound.
      return { kind: "NAT", value: v >= answer.min && v <= answer.max ? mid : String(answer.min) };
    }
    case "MTA":
      return anyResponse(type, rand);
  }
}

/** A response the key marks wrong. */
export function wrongResponse(type: QuestionType, answer: Answer, rand: () => number): UserResponse {
  switch (answer.kind) {
    case "MCQ": {
      const others = LABELS.filter((l) => l !== answer.correct);
      return { kind: "MCQ", choice: others[Math.floor(rand() * others.length)] };
    }
    case "MSQ": {
      const correct = new Set(answer.correct);
      // Either miss one correct option or add one wrong option; never the exact set.
      const wrong = LABELS.filter((l) => !correct.has(l));
      if (wrong.length && (rand() < 0.5 || correct.size === 1)) {
        return { kind: "MSQ", choices: [...correct, wrong[Math.floor(rand() * wrong.length)]].sort() };
      }
      const keep = [...correct].sort();
      keep.splice(Math.floor(rand() * keep.length), 1);
      return { kind: "MSQ", choices: keep.length ? keep : [wrong[0] ?? "A"] };
    }
    case "NAT": {
      const width = Math.max(Math.abs(answer.max - answer.min), Math.abs(answer.max) * 0.1, 1);
      const off = width * (1 + Math.floor(rand() * 3));
      return { kind: "NAT", value: niceNumber(rand() < 0.5 ? answer.min - off : answer.max + off) };
    }
    case "MTA":
      return anyResponse(type, rand);
  }
}

function anyResponse(type: QuestionType, rand: () => number): UserResponse {
  if (type === "NAT") return { kind: "NAT", value: String(Math.floor(rand() * 10)) };
  if (type === "MSQ") return { kind: "MSQ", choices: [LABELS[Math.floor(rand() * 4)]] };
  return { kind: "MCQ", choice: LABELS[Math.floor(rand() * 4)] };
}

function niceNumber(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function atTime(day: Date, minutes: number): Date {
  const d = new Date(day.getTime());
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

function daysBefore(now: Date, n: number): Date {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - n);
  return d;
}

const DEMO_NOTES = [
  "(Demo) Re-derive the formula before substituting numbers.",
  "(Demo) Read every option before choosing; two looked alike.",
  "(Demo) Check the units and the rounding instruction.",
  "(Demo) Revise the definition; I mixed up two similar terms.",
  "(Demo) Write the intermediate steps instead of doing them mentally.",
];

// ------------------------------------------------------------------ generator

/**
 * Generate a realistic-looking but clearly fictional study history from real
 * question ids. Pure and deterministic for a fixed input.
 */
export function generateDemoData(input: DemoInput): DemoData {
  const rand = mulberry32(input.seed);
  const now = new Date(input.now.getTime());
  const days = Math.max(7, Math.min(120, Math.round(input.days ?? 28)));
  const questions = [...input.questions].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(questions.map((q) => [q.id, q]));

  // Study skill per subject and topic (sorted so assignment order is stable).
  const skill = new Map<string, number>();
  for (const s of [...new Set(questions.map((q) => q.subjectId))].sort()) skill.set(`s:${s}`, 0.35 + rand() * 0.5);
  for (const q of questions) {
    const k = `t:${q.topicId}`;
    if (!skill.has(k)) skill.set(k, clamp((skill.get(`s:${q.subjectId}`) ?? 0.6) + (rand() - 0.5) * 0.35, 0.1, 0.95));
  }
  const pCorrect = (q: DemoQuestion) => skill.get(`t:${q.topicId}`) ?? 0.6;

  // Study days, oldest first; the last three days are always study days (a visible streak).
  const studyDays: Date[] = [];
  for (let d = days - 1; d >= 0; d--) if (d < 3 || rand() < 0.7) studyDays.push(daysBefore(now, d));

  const attempts: AttemptRow[] = [];
  const revision = new Map<string, RevisionItemRow>();
  const errorLogs = new Map<string, ErrorLogRow>();
  let nextAttemptId = 1;

  const recordRevision = (q: DemoQuestion, reason: RevisionItemRow["reasons"][number], at: Date) => {
    const key = `question:${q.id}`;
    const existing = revision.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons = [...existing.reasons, reason];
      if (reason === "incorrect") {
        const today = initialState(at).nextReview;
        if (today < existing.nextReview) existing.nextReview = today;
      }
      return;
    }
    revision.set(key, {
      key,
      kind: "question",
      refId: q.id,
      title: q.title,
      subjectId: q.subjectId,
      topicId: q.topicId,
      reasons: [reason],
      ...initialState(at),
      createdAt: at.toISOString(),
    });
  };

  const recordError = (q: DemoQuestion, response: UserResponse, attemptId: number, at: Date) => {
    const existing = errorLogs.get(q.id);
    if (existing) {
      existing.yourAnswer = formatResponse(response);
      existing.updatedAt = at.toISOString();
      existing.attemptId = attemptId;
      return;
    }
    const classified = rand() < 0.65;
    errorLogs.set(q.id, {
      id: errorLogs.size + 1,
      questionId: q.id,
      origin: q.origin,
      subjectId: q.subjectId,
      topicId: q.topicId,
      title: q.title,
      mistakeType: classified ? MISTAKE_TYPES[Math.floor(rand() * MISTAKE_TYPES.length)] : null,
      correctConcept: q.topicName,
      note: classified && rand() < 0.6 ? DEMO_NOTES[Math.floor(rand() * DEMO_NOTES.length)] : "",
      yourAnswer: formatResponse(response),
      correctAnswer: formatAnswer(q.answer),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      revisionStatus: "open",
      attemptId,
    });
  };

  const addAttempt = (q: DemoQuestion, correct: boolean, at: Date, context: AttemptRow["context"], extra: Partial<AttemptRow> = {}, negativeMarking = true) => {
    const response = correct ? correctResponse(q.type, q.answer, rand) : wrongResponse(q.type, q.answer, rand);
    const s = scoreQuestion(q, response, { negativeMarking, mtaPolicy: "exclude" });
    const confRoll = rand();
    const confidence: AttemptRow["confidence"] =
      confRoll < 0.3 ? undefined : s.status === "correct" ? (confRoll < 0.75 ? "high" : "medium") : confRoll < 0.6 ? "medium" : "low";
    const row: AttemptRow = {
      id: nextAttemptId++,
      questionId: q.id,
      origin: q.origin,
      subjectId: q.subjectId,
      topicId: q.topicId,
      context,
      response,
      status: s.status,
      marksAwarded: s.marks,
      maxMarks: s.maxMarks,
      timeSpentMs: Math.round(q.estimatedTimeSec * 1000 * (0.55 + rand() * 0.9)),
      confidence,
      createdAt: at.toISOString(),
      day: localDay(at),
      ...extra,
    };
    attempts.push(row);
    if (s.status === "incorrect") {
      recordRevision(q, "incorrect", at);
      recordError(q, response, row.id!, at);
    }
    return row;
  };

  // ---------------------------------------------------------------- PYQ practice
  const pyqs = questions.filter((q) => q.origin === "OFFICIAL_PYQ");
  const picked = shuffle(pyqs, rand).slice(0, Math.min(pyqs.length, Math.max(1, Math.round(pyqs.length * 0.45)), 110));
  const perDay = studyDays.length ? Math.ceil(picked.length / studyDays.length) : picked.length;
  picked.forEach((q, i) => {
    const day = studyDays[Math.min(studyDays.length - 1, Math.floor(i / Math.max(1, perDay)))] ?? now;
    let at = atTime(day, 7 * 60 + Math.floor(rand() * 14 * 60) + (i % perDay) * 4);
    if (at > now) at = new Date(now.getTime() - (picked.length - i) * 60_000);
    addAttempt(q, rand() < pCorrect(q), at, rand() < 0.2 ? "daily" : "pyq");
  });

  // A few second attempts of questions that were wrong the first time.
  const wrongFirst = [...new Set(attempts.filter((a) => a.status === "incorrect").map((a) => a.questionId))];
  for (const id of shuffle(wrongFirst, rand).slice(0, Math.ceil(wrongFirst.length / 3))) {
    const q = byId.get(id)!;
    const first = attempts.find((a) => a.questionId === id)!;
    const later = studyDays.filter((d) => localDay(d) > first.day);
    if (!later.length) continue;
    const day = later[Math.floor(rand() * later.length)];
    let at = atTime(day, 18 * 60 + Math.floor(rand() * 180));
    if (at > now) at = new Date(now.getTime() - 60_000);
    addAttempt(q, rand() < 0.7, at, "revision");
  }

  // ---------------------------------------------------------------- mock tests
  const mockAttempts: MockAttemptRow[] = [];
  const mocks = [...(input.mocks ?? [])]
    .filter((m) => m.questionIds.length > 0 && m.questionIds.every((id) => byId.get(id)?.testId === m.id))
    .sort((a, b) => a.number - b.number)
    .slice(0, 3);
  mocks.forEach((m, i) => {
    const daysAgo = Math.max(1, Math.round(((mocks.length - i) / (mocks.length + 1)) * days));
    const startedAt = atTime(daysBefore(now, daysAgo), 10 * 60 + Math.floor(rand() * 60));
    const qs = m.questionIds.map((id) => byId.get(id)!);
    const durationMs = m.durationMinutes * 60_000;
    const states: Record<string, MockQuestionState> = {};
    const responses: Record<string, UserResponse | null> = {};
    let used = 0;
    for (const q of qs) {
      const answered = rand() < 0.82;
      const response = answered ? (rand() < pCorrect(q) ? correctResponse(q.type, q.answer, rand) : wrongResponse(q.type, q.answer, rand)) : null;
      const timeSpentMs = Math.round(q.estimatedTimeSec * 1000 * (answered ? 0.6 + rand() * 0.8 : 0.2 + rand() * 0.3));
      used += timeSpentMs;
      responses[q.id] = response;
      states[q.id] = {
        response,
        markedForReview: rand() < 0.1,
        visited: answered || rand() < 0.7,
        timeSpentMs,
        confidence: answered && rand() < 0.6 ? (rand() < 0.5 ? "high" : "medium") : undefined,
      };
    }
    const timeUsed = Math.min(durationMs, used);
    const submittedAt = new Date(startedAt.getTime() + timeUsed);
    const score = scoreTest(qs, responses, { negativeMarking: m.negativeMarking, mtaPolicy: "exclude" });
    const attemptId = `demo-${m.id}-${input.seed >>> 0}`;
    mockAttempts.push({
      id: attemptId,
      testId: m.id,
      status: "submitted",
      startedAt: startedAt.toISOString(),
      submittedAt: submittedAt.toISOString(),
      durationMs,
      remainingMs: durationMs - timeUsed,
      currentIndex: qs.length - 1,
      questions: states,
      result: {
        score: score.score,
        maxScore: score.maxScore,
        correct: score.correct,
        incorrect: score.incorrect,
        unanswered: score.unanswered,
        attempted: score.attempted,
        accuracy: score.accuracy,
        timeUsedMs: timeUsed,
      },
    });
    // Per-question attempt rows, exactly as a real submission records them.
    qs.forEach((q, k) => {
      const s = score.perQuestion[k];
      const st = states[q.id];
      const row: AttemptRow = {
        id: nextAttemptId++,
        questionId: q.id,
        origin: q.origin,
        subjectId: q.subjectId,
        topicId: q.topicId,
        context: "mock",
        mockAttemptId: attemptId,
        response: st.response,
        status: s.status,
        marksAwarded: s.marks,
        maxMarks: s.maxMarks,
        timeSpentMs: st.timeSpentMs,
        confidence: st.confidence,
        createdAt: submittedAt.toISOString(),
        day: localDay(submittedAt),
      };
      attempts.push(row);
      if (s.status === "incorrect" && st.response) {
        recordRevision(q, "incorrect", submittedAt);
        recordError(q, st.response, row.id!, submittedAt);
      }
    });
  });

  // ---------------------------------------------------------------- revision reviews
  const grades: RecallGrade[] = ["forgot", "almost", "got_it"];
  const revisionItems = [...revision.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const item of revisionItems) {
    let state: RevisionState = {
      intervalDays: item.intervalDays,
      ease: item.ease,
      reviewCount: item.reviewCount,
      lapses: item.lapses,
      lastReviewed: item.lastReviewed,
      nextReview: item.nextReview,
      confidence: item.confidence,
    };
    for (const d of studyDays) {
      const day = localDay(d);
      if (day < state.nextReview || day <= localDay(new Date(item.createdAt)) || rand() < 0.35) continue;
      const r = rand();
      const grade = grades[r < 0.25 ? 0 : r < 0.6 ? 1 : 2];
      let at = atTime(d, 20 * 60 + Math.floor(rand() * 90));
      if (at > now) at = new Date(now.getTime() - 30_000);
      state = review(state, grade, at);
    }
    Object.assign(item, state);
  }

  // Error-log follow-up: resolved when the latest attempt is correct (sometimes), revising when reviewed.
  const latest = new Map<string, AttemptRow>();
  for (const a of attempts) {
    const p = latest.get(a.questionId);
    if (!p || p.createdAt <= a.createdAt) latest.set(a.questionId, a);
  }
  const errorRows = [...errorLogs.values()];
  for (const e of errorRows) {
    const last = latest.get(e.questionId);
    const rev = revision.get(`question:${e.questionId}`);
    if (last?.status === "correct" && rand() < 0.6) e.revisionStatus = "resolved";
    else if (rev && rev.reviewCount > 0) e.revisionStatus = "revising";
  }

  // ---------------------------------------------------------------- bookmarks
  const attemptedIds = [...new Set(attempts.filter((a) => a.origin === "OFFICIAL_PYQ").map((a) => a.questionId))].sort();
  const unattempted = pyqs.filter((q) => !attemptedIds.includes(q.id)).map((q) => q.id);
  const bookmarkIds = [...shuffle(attemptedIds, rand).slice(0, 7), ...shuffle(unattempted, rand).slice(0, 3)];
  const bookmarks: BookmarkRow[] = bookmarkIds.map((id, i) => {
    const q = byId.get(id)!;
    const at = atTime(daysBefore(now, Math.max(0, days - 2 - i * 2)), 21 * 60);
    return {
      key: `question:${id}`,
      kind: "question",
      refId: id,
      title: q.title,
      subjectId: q.subjectId,
      createdAt: (at > now ? now : at).toISOString(),
    };
  });
  for (const b of bookmarks.slice(0, 3)) {
    const q = byId.get(b.refId)!;
    recordRevision(q, "bookmarked", new Date(b.createdAt));
  }

  const info: DemoInfo = { seed: input.seed >>> 0, generatedAt: now.toISOString(), pyqs: picked.length, mocks: mocks.map((m) => m.id) };
  return {
    attempts,
    mockAttempts,
    bookmarks,
    revisionItems: [...revision.values()].sort((a, b) => a.key.localeCompare(b.key)),
    errorLogs: errorRows,
    settings: [{ key: DEMO_INFO_KEY, value: info }],
  };
}

// ------------------------------------------------------------------ writer

export class NotDemoDatabaseError extends Error {
  constructor(name: string) {
    super(`Refusing to write demo data to "${name}": demo data may only be written to the separate "${DEMO_DB_NAME}" database.`);
    this.name = "NotDemoDatabaseError";
  }
}

/**
 * Replace the contents of the DEMO database with `data`. Throws (and writes
 * nothing) for any other database, including the real user database.
 */
export async function writeDemoData(db: GateDaDB, data: DemoData): Promise<void> {
  if (db.name !== DEMO_DB_NAME) throw new NotDemoDatabaseError(db.name);
  const tables = [db.attempts, db.mockAttempts, db.bookmarks, db.revisionItems, db.errorLogs, db.roadmap, db.settings, db.views];
  await db.transaction("rw", tables, async () => {
    for (const t of tables) await t.clear();
    await db.attempts.bulkAdd(data.attempts);
    await db.mockAttempts.bulkAdd(data.mockAttempts);
    await db.bookmarks.bulkAdd(data.bookmarks);
    await db.revisionItems.bulkAdd(data.revisionItems);
    await db.errorLogs.bulkAdd(data.errorLogs);
    await db.settings.bulkAdd(data.settings);
  });
}

/** Every question id referenced anywhere in the generated data (used by tests and as a runtime guard). */
export function referencedQuestionIds(data: DemoData): Set<string> {
  const ids = new Set<string>();
  for (const a of data.attempts) ids.add(a.questionId);
  for (const b of data.bookmarks) ids.add(b.refId);
  for (const r of data.revisionItems) ids.add(r.refId);
  for (const e of data.errorLogs) ids.add(e.questionId);
  for (const m of data.mockAttempts) for (const id of Object.keys(m.questions)) ids.add(id);
  return ids;
}
