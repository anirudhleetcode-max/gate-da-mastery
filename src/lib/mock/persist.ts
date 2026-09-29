/**
 * IndexedDB persistence for mock attempts.
 *
 * `src/lib/userdata/ops.ts` has no mock-attempt operations yet, so they live
 * here, next to the engine that owns the rules. Per-question attempts, the
 * revision queue and the error log are still written ONLY through the shared
 * ops (`recordAttemptWithFollowUps`, `addErrorLog`, `getSetting`).
 *
 * Invariants:
 *  - At most one in-progress attempt per mock is resumed (the newest).
 *  - A submitted attempt is never overwritten by an in-progress save.
 *  - Finalising (scoring + recording) happens once per attempt, atomically.
 */
import type { GateDaDB, MockAttemptRow } from "@/lib/userdata/db";
import { addErrorLog, getSetting, recordAttemptWithFollowUps } from "@/lib/userdata/ops";
import { formatAnswer, formatResponse } from "@/lib/scoring/score";
import { createAttempt, reconcileAttempt, submittedAttempt } from "./session";
import { resultSummary, scoreAttempt } from "./analysis";
import type { KeyResponse } from "./types";

/** A new attempt id (UUID v4). */
export function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for non-secure contexts (e.g. http on a LAN address), where randomUUID is unavailable.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Title used for revision and error-log entries, identical to QuestionView's ("Mock 7 · Q.3"). */
export function mockQuestionTitle(mockNumber: number, questionNumber: number): string {
  return `Mock ${mockNumber} · Q.${questionNumber}`;
}

/** The newest in-progress attempt of a mock, if any. */
export async function findInProgress(db: GateDaDB, testId: string): Promise<MockAttemptRow | undefined> {
  const rows = await db.mockAttempts.where("testId").equals(testId).filter((a) => a.status === "in_progress").toArray();
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/**
 * Resume the in-progress attempt of this mock, or create one. Runs in a
 * transaction, so two concurrent calls (e.g. React strict mode) cannot create
 * two attempts.
 */
export async function startOrResume(
  db: GateDaDB,
  test: { id: string; durationMinutes: number },
  questionIds: readonly string[],
  opts: { now?: Date; newId?: () => string } = {},
): Promise<{ attempt: MockAttemptRow; resumed: boolean }> {
  const now = opts.now ?? new Date();
  const makeId = opts.newId ?? newAttemptId;
  return db.transaction("rw", db.mockAttempts, async () => {
    const existing = await findInProgress(db, test.id);
    if (existing) {
      const attempt = reconcileAttempt(existing, questionIds);
      await db.mockAttempts.put(attempt);
      return { attempt, resumed: true };
    }
    const attempt = createAttempt(test, questionIds, { id: makeId(), now });
    await db.mockAttempts.add(attempt);
    return { attempt, resumed: false };
  });
}

export type SaveResult = "saved" | "submitted" | "missing";

/**
 * Save an in-progress attempt. Refuses to overwrite an attempt that has been
 * submitted, and does not resurrect one that was discarded elsewhere.
 */
export async function saveProgress(db: GateDaDB, attempt: MockAttemptRow): Promise<SaveResult> {
  return db.transaction("rw", db.mockAttempts, async () => {
    const cur = await db.mockAttempts.get(attempt.id);
    if (!cur) return "missing";
    if (cur.status === "submitted") return "submitted";
    await db.mockAttempts.put(attempt);
    return "saved";
  });
}

/** Mark an attempt submitted (answers locked, timer stopped) before it is scored. */
export async function saveSubmission(db: GateDaDB, attempt: MockAttemptRow, now = new Date()): Promise<MockAttemptRow> {
  return db.transaction("rw", db.mockAttempts, async () => {
    const cur = await db.mockAttempts.get(attempt.id);
    if (cur?.status === "submitted") return cur;
    const row = submittedAttempt(attempt, now);
    await db.mockAttempts.put(row);
    return row;
  });
}

/** Delete an in-progress attempt (submitted attempts are kept). Returns true if deleted. */
export async function discardInProgress(db: GateDaDB, attemptId: string): Promise<boolean> {
  return db.transaction("rw", db.mockAttempts, async () => {
    const cur = await db.mockAttempts.get(attemptId);
    if (!cur || cur.status !== "in_progress") return false;
    await db.mockAttempts.delete(attemptId);
    return true;
  });
}

/**
 * Score a submitted attempt and record it, exactly once:
 *  - one AttemptRow per question (context "mock", with response, status, marks,
 *    time and confidence) via `recordAttemptWithFollowUps`, so every incorrect
 *    answer is queued for revision;
 *  - incorrect answers are added to the error log when the `autoErrorLog`
 *    setting is on (default on);
 *  - the result summary is saved on the attempt.
 * Idempotent: an attempt that already has a result is returned unchanged.
 */
export async function finalizeAttempt(db: GateDaDB, attemptId: string, key: KeyResponse, now = new Date()): Promise<MockAttemptRow> {
  const byId = new Map(key.questions.map((q) => [q.id, q]));
  const questions = key.test.questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
  return db.transaction("rw", [db.mockAttempts, db.attempts, db.revisionItems, db.errorLogs, db.settings], async () => {
    const a = await db.mockAttempts.get(attemptId);
    if (!a) throw new Error("This mock attempt was not found on this device.");
    if (a.result) return a;
    const submitted = submittedAttempt(a, now);
    const at = new Date(submitted.submittedAt!);
    const autoErrorLog = await getSetting(db, "autoErrorLog", true);
    const { score } = scoreAttempt(questions, submitted, key.test.negativeMarking);
    for (const [i, q] of questions.entries()) {
      const s = score.perQuestion[i];
      const st = submitted.questions[q.id];
      const title = mockQuestionTitle(key.test.number, q.questionNumber ?? i + 1);
      const response = st?.response ?? null;
      const rowId = await recordAttemptWithFollowUps(
        db,
        {
          questionId: q.id,
          origin: q.origin,
          subjectId: q.subjectId,
          topicId: q.topicId,
          context: "mock",
          mockAttemptId: submitted.id,
          response,
          status: s.status,
          marksAwarded: s.marks,
          maxMarks: s.maxMarks,
          timeSpentMs: Math.round(st?.timeSpentMs ?? 0),
          confidence: st?.confidence,
        },
        { title },
        at,
      );
      if (s.status === "incorrect" && autoErrorLog) {
        await addErrorLog(
          db,
          {
            questionId: q.id,
            origin: q.origin,
            subjectId: q.subjectId,
            topicId: q.topicId,
            title,
            yourAnswer: formatResponse(response),
            correctAnswer: formatAnswer(q.answer),
            attemptId: rowId,
            correctConcept: q.concepts[0]?.title ?? q.topicName,
          },
          at,
        );
      }
    }
    const final: MockAttemptRow = { ...submitted, result: resultSummary(score, submitted) };
    await db.mockAttempts.put(final);
    return final;
  });
}
