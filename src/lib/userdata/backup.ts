/**
 * Validation of an imported backup file. A backup is user-editable JSON, so
 * every row is checked against the shape the app writes; rows that do not
 * match are dropped (and counted), never written. Bookmark snapshots are
 * sanitised and stored links must stay on this site.
 */
import { z } from "zod";
import { OptionLabel, QuestionOrigin, SubjectId } from "@/lib/content/schema";
import { MISTAKE_TYPES } from "./db";
import { safeInternalHref, sanitizeSnapshotHtml } from "./sanitize";

const Str = z.string().max(2000);
const Id = z.string().min(1).max(200);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DateTime = z.string().min(10).max(40).refine((s) => !Number.isNaN(Date.parse(s)), "not a date");
const Confidence = z.enum(["high", "medium", "low"]);
const Response = z
  .union([
    z.object({ kind: z.literal("MCQ"), choice: OptionLabel }),
    z.object({ kind: z.literal("MSQ"), choices: z.array(OptionLabel).max(4) }),
    z.object({ kind: z.literal("NAT"), value: z.string().max(40) }),
  ])
  .nullable();

const Attempt = z.object({
  id: z.number().int().positive().optional(),
  questionId: Id,
  origin: QuestionOrigin,
  subjectId: SubjectId,
  topicId: Id,
  context: z.enum(["pyq", "practice", "mock", "daily", "revision"]),
  mockAttemptId: Id.optional(),
  response: Response,
  status: z.enum(["correct", "incorrect", "unanswered", "not_scored"]),
  marksAwarded: z.number().finite(),
  maxMarks: z.number().finite(),
  timeSpentMs: z.number().finite().nonnegative(),
  confidence: Confidence.optional(),
  createdAt: DateTime,
  day: Day,
});

const MockAttempt = z.object({
  id: Id,
  testId: Id,
  status: z.enum(["in_progress", "submitted"]),
  startedAt: DateTime,
  submittedAt: DateTime.optional(),
  durationMs: z.number().finite().nonnegative(),
  remainingMs: z.number().finite(),
  currentIndex: z.number().int().nonnegative(),
  questions: z.record(
    Id,
    z.object({
      response: Response,
      markedForReview: z.boolean(),
      visited: z.boolean(),
      timeSpentMs: z.number().finite().nonnegative(),
      confidence: Confidence.optional(),
    }),
  ),
  result: z
    .object({
      score: z.number().finite(),
      maxScore: z.number().finite(),
      correct: z.number().int().nonnegative(),
      incorrect: z.number().int().nonnegative(),
      unanswered: z.number().int().nonnegative(),
      attempted: z.number().int().nonnegative(),
      accuracy: z.number().finite().nullable(),
      timeUsedMs: z.number().finite().nonnegative(),
    })
    .optional(),
});

const Bookmark = z.object({
  key: Id,
  kind: z.enum(["question", "concept", "formula", "strategy"]),
  refId: Id,
  title: Str,
  subjectId: SubjectId.optional(),
  note: Str.optional(),
  createdAt: DateTime,
  snapshot: z.object({ html: z.string().max(200_000), href: Str, savedAt: DateTime }).optional(),
});

const RevisionItem = z.object({
  key: Id,
  kind: z.enum(["question", "concept", "formula"]),
  refId: Id,
  title: Str,
  subjectId: SubjectId.optional(),
  topicId: Id.optional(),
  reasons: z.array(z.enum(["incorrect", "difficult", "bookmarked", "manual", "weak_topic"])).max(10),
  intervalDays: z.number().finite().nonnegative(),
  ease: z.number().finite().positive(),
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReviewed: z.string().max(40).nullable(),
  nextReview: Day,
  confidence: z.enum(["got_it", "almost", "forgot"]).nullable(),
  createdAt: DateTime,
});

const ErrorLog = z.object({
  id: z.number().int().positive().optional(),
  questionId: Id,
  origin: QuestionOrigin,
  subjectId: SubjectId,
  topicId: Id,
  title: Str,
  mistakeType: z.enum(MISTAKE_TYPES).nullable(),
  correctConcept: Str,
  note: z.string().max(10_000),
  yourAnswer: Str,
  correctAnswer: Str,
  createdAt: DateTime,
  updatedAt: DateTime,
  revisionStatus: z.enum(["open", "revising", "resolved"]),
  attemptId: z.number().int().positive().optional(),
});

const Roadmap = z.object({ stageId: Id, completed: z.boolean(), completedAt: DateTime.optional(), note: Str.optional() });
const Setting = z.object({ key: Id, value: z.unknown() }).refine((s) => JSON.stringify(s.value ?? null).length < 20_000, "setting too large");
const View = z.object({ key: Id, kind: z.enum(["concept", "formula", "strategy"]), refId: Id, viewedAt: DateTime, day: Day });

export const BACKUP_TABLES = {
  attempts: Attempt,
  mockAttempts: MockAttempt,
  bookmarks: Bookmark,
  revisionItems: RevisionItem,
  errorLogs: ErrorLog,
  roadmap: Roadmap,
  settings: Setting,
  views: View,
} as const;
export type BackupTable = keyof typeof BACKUP_TABLES;

export interface CleanBackup {
  rows: { [K in BackupTable]: z.infer<(typeof BACKUP_TABLES)[K]>[] };
  dropped: Partial<Record<BackupTable, number>>;
}

/** Validate every row of a backup; invalid rows are dropped and counted. */
export function cleanBackup(data: Record<string, unknown>): CleanBackup {
  const rows = {} as CleanBackup["rows"];
  const dropped: CleanBackup["dropped"] = {};
  for (const [table, schema] of Object.entries(BACKUP_TABLES) as [BackupTable, z.ZodTypeAny][]) {
    const input = Array.isArray(data[table]) ? (data[table] as unknown[]) : [];
    const ok: unknown[] = [];
    for (const row of input) {
      const r = schema.safeParse(row);
      if (r.success) ok.push(r.data);
      else dropped[table] = (dropped[table] ?? 0) + 1;
    }
    (rows as Record<string, unknown[]>)[table] = ok;
  }
  // Bookmark snapshots: sanitise the saved HTML and keep only same-site links.
  rows.bookmarks = rows.bookmarks.map((b) => {
    if (!b.snapshot) return b;
    const href = safeInternalHref(b.snapshot.href);
    const html = sanitizeSnapshotHtml(b.snapshot.html);
    return href ? { ...b, snapshot: { ...b.snapshot, href, html } } : { ...b, snapshot: undefined };
  });
  return { rows, dropped };
}
