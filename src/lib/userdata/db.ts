/**
 * Local-first user data (IndexedDB via Dexie).
 *
 * Real user data lives in the "gate-da-user" database. Demo data, if the user
 * explicitly enables it from Settings, lives in a SEPARATE "gate-da-demo"
 * database and the UI shows a persistent DEMO DATA banner. Nothing is seeded
 * into the real database, ever.
 */
import Dexie, { type EntityTable } from "dexie";
import type { OptionLabel, QuestionOrigin, SubjectId } from "@/lib/content/schema";
import type { UserResponse } from "@/lib/scoring/score";
import type { RecallGrade } from "@/lib/revision/schedule";

export type AttemptContext = "pyq" | "practice" | "mock" | "daily" | "revision";

export interface AttemptRow {
  id?: number;
  questionId: string;
  origin: QuestionOrigin;
  subjectId: SubjectId;
  topicId: string;
  context: AttemptContext;
  /** Present when the attempt was part of a mock attempt. */
  mockAttemptId?: string;
  response: UserResponse | null;
  status: "correct" | "incorrect" | "unanswered" | "not_scored";
  marksAwarded: number;
  maxMarks: number;
  timeSpentMs: number;
  /** Self-reported confidence before revealing ("high" | "medium" | "low"), if given. */
  confidence?: "high" | "medium" | "low";
  createdAt: string; // ISO date-time
  day: string; // YYYY-MM-DD (local) for streaks
}

export interface MockQuestionState {
  response: UserResponse | null;
  markedForReview: boolean;
  visited: boolean;
  timeSpentMs: number;
  confidence?: "high" | "medium" | "low";
}

export interface MockAttemptRow {
  id: string; // uuid
  testId: string;
  status: "in_progress" | "submitted";
  startedAt: string;
  submittedAt?: string;
  durationMs: number;
  /** Remaining time when last saved (for resume). */
  remainingMs: number;
  currentIndex: number;
  questions: Record<string, MockQuestionState>;
  /** Filled on submission. */
  result?: {
    score: number;
    maxScore: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    attempted: number;
    accuracy: number | null;
    timeUsedMs: number;
  };
}

export type BookmarkKind = "question" | "concept" | "formula" | "strategy";

export interface BookmarkRow {
  key: string; // `${kind}:${refId}`
  kind: BookmarkKind;
  refId: string;
  title: string;
  subjectId?: SubjectId;
  note?: string;
  createdAt: string;
  /** Snapshot for offline viewing (rendered HTML fragment), when available. */
  snapshot?: { html: string; href: string; savedAt: string };
}

export type RevisionKind = "question" | "concept" | "formula";
export type RevisionReason = "incorrect" | "difficult" | "bookmarked" | "manual" | "weak_topic";

export interface RevisionItemRow {
  key: string; // `${kind}:${refId}`
  kind: RevisionKind;
  refId: string;
  title: string;
  subjectId?: SubjectId;
  topicId?: string;
  reasons: RevisionReason[];
  intervalDays: number;
  ease: number;
  reviewCount: number;
  lapses: number;
  lastReviewed: string | null;
  nextReview: string; // YYYY-MM-DD
  confidence: RecallGrade | null;
  createdAt: string;
}

export const MISTAKE_TYPES = [
  "conceptual",
  "calculation",
  "misread",
  "formula",
  "time_pressure",
  "guessing",
  "silly",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  conceptual: "Conceptual mistake",
  calculation: "Calculation mistake",
  misread: "Misread question",
  formula: "Formula mistake",
  time_pressure: "Time-pressure mistake",
  guessing: "Guessing mistake",
  silly: "Silly mistake",
};

export interface ErrorLogRow {
  id?: number;
  questionId: string;
  origin: QuestionOrigin;
  subjectId: SubjectId;
  topicId: string;
  title: string;
  mistakeType: MistakeType | null;
  correctConcept: string;
  note: string;
  yourAnswer: string;
  correctAnswer: string;
  createdAt: string;
  updatedAt: string;
  revisionStatus: "open" | "revising" | "resolved";
  attemptId?: number;
}

export interface RoadmapRow {
  stageId: string;
  completed: boolean;
  completedAt?: string;
  note?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface ViewRow {
  key: string; // `${kind}:${refId}`
  kind: "concept" | "formula" | "strategy";
  refId: string;
  viewedAt: string;
  day: string;
}

export class GateDaDB extends Dexie {
  attempts!: EntityTable<AttemptRow, "id">;
  mockAttempts!: EntityTable<MockAttemptRow, "id">;
  bookmarks!: EntityTable<BookmarkRow, "key">;
  revisionItems!: EntityTable<RevisionItemRow, "key">;
  errorLogs!: EntityTable<ErrorLogRow, "id">;
  roadmap!: EntityTable<RoadmapRow, "stageId">;
  settings!: EntityTable<SettingRow, "key">;
  views!: EntityTable<ViewRow, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      attempts: "++id, questionId, origin, subjectId, topicId, context, mockAttemptId, status, createdAt, day, [questionId+createdAt]",
      mockAttempts: "id, testId, status, startedAt, submittedAt",
      bookmarks: "key, kind, refId, subjectId, createdAt",
      revisionItems: "key, kind, refId, subjectId, topicId, nextReview, confidence, createdAt",
      errorLogs: "++id, questionId, subjectId, topicId, mistakeType, revisionStatus, createdAt",
      roadmap: "stageId",
      settings: "key",
      views: "key, kind, day",
    });
  }
}

export const REAL_DB_NAME = "gate-da-user";
export const DEMO_DB_NAME = "gate-da-demo";
const DEMO_FLAG = "gate-da-demo-mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(DEMO_FLAG, "1");
    else window.localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* storage unavailable: demo mode simply stays off */
  }
}

let instance: GateDaDB | null = null;
let instanceName: string | null = null;

/** The active database (real, or demo when demo mode is on). */
export function getDb(): GateDaDB {
  const name = isDemoMode() ? DEMO_DB_NAME : REAL_DB_NAME;
  if (!instance || instanceName !== name) {
    instance?.close();
    instance = new GateDaDB(name);
    instanceName = name;
  }
  return instance;
}

/** For tests: use an explicitly named database. */
export function createDb(name: string): GateDaDB {
  return new GateDaDB(name);
}

export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type { OptionLabel };
