/**
 * User-data operations. Every UI mutation goes through these functions so the
 * rules (e.g. "an incorrect answer is queued for revision and offered to the
 * error log") live in one tested place.
 */
import type { GateDaDB, AttemptRow, BookmarkKind, BookmarkRow, ErrorLogRow, MistakeType, RevisionItemRow, RevisionKind, RevisionReason } from "./db";
import { localDay } from "./db";
import { cleanBackup } from "./backup";
import { initialState, review, type RecallGrade } from "@/lib/revision/schedule";

export async function recordAttempt(db: GateDaDB, row: Omit<AttemptRow, "id" | "createdAt" | "day">, now = new Date()): Promise<number> {
  const id = await db.attempts.add({ ...row, createdAt: now.toISOString(), day: localDay(now) });
  return id as number;
}

/**
 * After an attempt: an incorrect answer is automatically added to the
 * revision queue (reason "incorrect"). Returns the attempt id.
 */
export async function recordAttemptWithFollowUps(
  db: GateDaDB,
  row: Omit<AttemptRow, "id" | "createdAt" | "day">,
  meta: { title: string },
  now = new Date(),
): Promise<number> {
  const id = await recordAttempt(db, row, now);
  if (row.status === "incorrect") {
    await addToRevision(db, { kind: "question", refId: row.questionId, title: meta.title, subjectId: row.subjectId, topicId: row.topicId, reason: "incorrect" }, now);
  }
  return id;
}

// ---------------------------------------------------------------- bookmarks

export const bookmarkKey = (kind: BookmarkKind, refId: string) => `${kind}:${refId}`;

export async function isBookmarked(db: GateDaDB, kind: BookmarkKind, refId: string): Promise<boolean> {
  return (await db.bookmarks.get(bookmarkKey(kind, refId))) !== undefined;
}

export async function toggleBookmark(
  db: GateDaDB,
  b: Omit<BookmarkRow, "key" | "createdAt">,
  now = new Date(),
): Promise<boolean> {
  const key = bookmarkKey(b.kind, b.refId);
  const existing = await db.bookmarks.get(key);
  if (existing) {
    await db.bookmarks.delete(key);
    return false;
  }
  await db.bookmarks.put({ ...b, key, createdAt: now.toISOString() });
  return true;
}

// ---------------------------------------------------------------- revision

export const revisionKey = (kind: RevisionKind, refId: string) => `${kind}:${refId}`;

export async function addToRevision(
  db: GateDaDB,
  item: { kind: RevisionKind; refId: string; title: string; subjectId?: RevisionItemRow["subjectId"]; topicId?: string; reason: RevisionReason },
  now = new Date(),
): Promise<RevisionItemRow> {
  const key = revisionKey(item.kind, item.refId);
  return db.transaction("rw", db.revisionItems, async () => {
    const existing = await db.revisionItems.get(key);
    if (existing) {
      const reasons = existing.reasons.includes(item.reason) ? existing.reasons : [...existing.reasons, item.reason];
      // A fresh mistake on a scheduled item brings it forward to today.
      const nextReview = item.reason === "incorrect" ? initialState(now).nextReview : existing.nextReview;
      const updated = { ...existing, reasons, nextReview: nextReview < existing.nextReview ? nextReview : existing.nextReview };
      await db.revisionItems.put(updated);
      return updated;
    }
    const st = initialState(now);
    const row: RevisionItemRow = {
      key,
      kind: item.kind,
      refId: item.refId,
      title: item.title,
      subjectId: item.subjectId,
      topicId: item.topicId,
      reasons: [item.reason],
      ...st,
      createdAt: now.toISOString(),
    };
    await db.revisionItems.put(row);
    return row;
  });
}

export async function gradeRevision(db: GateDaDB, key: string, grade: RecallGrade, now = new Date()): Promise<RevisionItemRow | undefined> {
  return db.transaction("rw", db.revisionItems, async () => {
    const item = await db.revisionItems.get(key);
    if (!item) return undefined;
    const next = review(item, grade, now);
    const updated = { ...item, ...next };
    await db.revisionItems.put(updated);
    return updated;
  });
}

export async function removeFromRevision(db: GateDaDB, key: string): Promise<void> {
  await db.revisionItems.delete(key);
}

export async function dueRevision(db: GateDaDB, now = new Date()): Promise<RevisionItemRow[]> {
  return db.revisionItems.where("nextReview").belowOrEqual(localDay(now)).sortBy("nextReview");
}

// ---------------------------------------------------------------- error log

export async function addErrorLog(
  db: GateDaDB,
  e: Omit<ErrorLogRow, "id" | "createdAt" | "updatedAt" | "revisionStatus" | "mistakeType" | "note" | "correctConcept"> & {
    mistakeType?: MistakeType | null;
    note?: string;
    correctConcept?: string;
  },
  now = new Date(),
): Promise<number> {
  // One open entry per question: repeated mistakes update the same entry.
  const existing = await db.errorLogs.where("questionId").equals(e.questionId).filter((x) => x.revisionStatus !== "resolved").first();
  if (existing?.id !== undefined) {
    await db.errorLogs.update(existing.id, {
      yourAnswer: e.yourAnswer,
      updatedAt: now.toISOString(),
      mistakeType: e.mistakeType ?? existing.mistakeType,
      note: e.note ?? existing.note,
    });
    return existing.id;
  }
  const id = await db.errorLogs.add({
    ...e,
    mistakeType: e.mistakeType ?? null,
    note: e.note ?? "",
    correctConcept: e.correctConcept ?? "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    revisionStatus: "open",
  });
  return id as number;
}

export async function updateErrorLog(db: GateDaDB, id: number, patch: Partial<Pick<ErrorLogRow, "mistakeType" | "note" | "correctConcept" | "revisionStatus">>, now = new Date()) {
  await db.errorLogs.update(id, { ...patch, updatedAt: now.toISOString() });
}

// ---------------------------------------------------------------- roadmap & settings

export async function setRoadmapStage(db: GateDaDB, stageId: string, completed: boolean, now = new Date()) {
  await db.roadmap.put({ stageId, completed, completedAt: completed ? now.toISOString() : undefined });
}

export async function getSetting<T>(db: GateDaDB, key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(db: GateDaDB, key: string, value: unknown) {
  await db.settings.put({ key, value });
}

// ---------------------------------------------------------------- backup

export const BACKUP_VERSION = 1;

export async function exportAll(db: GateDaDB) {
  return {
    app: "gate-da-mastery",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    attempts: await db.attempts.toArray(),
    mockAttempts: await db.mockAttempts.toArray(),
    bookmarks: await db.bookmarks.toArray(),
    revisionItems: await db.revisionItems.toArray(),
    errorLogs: await db.errorLogs.toArray(),
    roadmap: await db.roadmap.toArray(),
    settings: await db.settings.toArray(),
    views: await db.views.toArray(),
  };
}

export type Backup = Awaited<ReturnType<typeof exportAll>>;

/**
 * Replace all user data with a backup. The envelope is checked, then every row
 * is validated (src/lib/userdata/backup.ts): invalid rows are dropped, saved
 * question HTML is sanitised and stored links must stay on this site.
 * Returns how many rows were imported and dropped per table.
 */
export async function importAll(db: GateDaDB, data: unknown) {
  const b = data as Partial<Backup> & Record<string, unknown>;
  if (!b || typeof b !== "object" || b.app !== "gate-da-mastery" || typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new Error("Not a GATE DA Mastery backup file (or it comes from a newer version).");
  }
  const { rows, dropped } = cleanBackup(b);
  const tables = [db.attempts, db.mockAttempts, db.bookmarks, db.revisionItems, db.errorLogs, db.roadmap, db.settings, db.views];
  await db.transaction("rw", tables, async () => {
    for (const t of tables) await t.clear();
    await db.attempts.bulkPut(rows.attempts);
    await db.mockAttempts.bulkPut(rows.mockAttempts);
    await db.bookmarks.bulkPut(rows.bookmarks);
    await db.revisionItems.bulkPut(rows.revisionItems);
    await db.errorLogs.bulkPut(rows.errorLogs);
    await db.roadmap.bulkPut(rows.roadmap);
    await db.settings.bulkPut(rows.settings);
    await db.views.bulkPut(rows.views);
  });
  const imported = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])) as Record<keyof typeof rows, number>;
  return { imported, dropped };
}

/** Set (or clear, with an empty string) the student's note on a bookmark. */
export async function updateBookmarkNote(db: GateDaDB, key: string, note: string): Promise<void> {
  await db.bookmarks.update(key, { note: note.trim() ? note : undefined });
}

/** Remove a bookmark by key (idempotent, unlike toggleBookmark). */
export async function removeBookmark(db: GateDaDB, key: string): Promise<void> {
  await db.bookmarks.delete(key);
}

export async function clearAll(db: GateDaDB) {
  const tables = [db.attempts, db.mockAttempts, db.bookmarks, db.revisionItems, db.errorLogs, db.roadmap, db.settings, db.views];
  await db.transaction("rw", tables, async () => {
    for (const t of tables) await t.clear();
  });
}
