"use client";
/**
 * React hooks over the local user database. All reads are live queries, so
 * every view updates as soon as an attempt, bookmark or review is recorded.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, isDemoMode, setDemoMode, type AttemptRow, type BookmarkKind, type GateDaDB } from "./db";

interface Ctx {
  db: GateDaDB | null;
  demo: boolean;
  ready: boolean;
  setDemo: (on: boolean) => void;
  /** false if IndexedDB is unavailable (private mode / blocked storage). */
  available: boolean;
}

const UserDataContext = createContext<Ctx>({ db: null, demo: false, ready: false, setDemo: () => {}, available: true });

export function UserDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ db: GateDaDB | null; demo: boolean; ready: boolean; available: boolean }>({
    db: null,
    demo: false,
    ready: false,
    available: true,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb();
        await db.open();
        if (!cancelled) setState({ db, demo: isDemoMode(), ready: true, available: true });
      } catch {
        if (!cancelled) setState({ db: null, demo: false, ready: true, available: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const setDemo = useCallback((on: boolean) => {
    setDemoMode(on);
    const db = getDb();
    db.open()
      .then(() => setState({ db, demo: on, ready: true, available: true }))
      .catch(() => setState({ db: null, demo: false, ready: true, available: false }));
  }, []);
  const value = useMemo(() => ({ ...state, setDemo }), [state, setDemo]);
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  return useContext(UserDataContext);
}

/** Generic live query bound to the active database; returns `fallback` until ready. */
export function useDbQuery<T>(query: (db: GateDaDB) => Promise<T> | T, deps: unknown[], fallback: T): T {
  const { db } = useUserData();
  const result = useLiveQuery(async () => (db ? query(db) : fallback), [db, ...deps]);
  return result === undefined ? fallback : result;
}

export function useAttempts(): AttemptRow[] {
  return useDbQuery((db) => db.attempts.toArray(), [], [] as AttemptRow[]);
}

export interface QuestionStatus {
  attempts: number;
  correct: number;
  lastStatus: AttemptRow["status"];
  lastAt: string;
}

/** Per-question summary of the student's attempts. */
export function useQuestionStatuses(): Map<string, QuestionStatus> {
  const attempts = useAttempts();
  return useMemo(() => {
    const m = new Map<string, QuestionStatus>();
    for (const a of attempts) {
      const s = m.get(a.questionId);
      if (!s) m.set(a.questionId, { attempts: 1, correct: a.status === "correct" ? 1 : 0, lastStatus: a.status, lastAt: a.createdAt });
      else {
        s.attempts++;
        if (a.status === "correct") s.correct++;
        if (a.createdAt > s.lastAt) {
          s.lastAt = a.createdAt;
          s.lastStatus = a.status;
        }
      }
    }
    return m;
  }, [attempts]);
}

export function useBookmarks(kind?: BookmarkKind) {
  return useDbQuery((db) => (kind ? db.bookmarks.where("kind").equals(kind).reverse().sortBy("createdAt") : db.bookmarks.orderBy("createdAt").reverse().toArray()), [kind], []);
}

export function useBookmarkKeys(): Set<string> {
  const rows = useDbQuery((db) => db.bookmarks.toCollection().primaryKeys(), [], [] as string[]);
  return useMemo(() => new Set(rows), [rows]);
}

export function useRevisionItems() {
  return useDbQuery((db) => db.revisionItems.orderBy("nextReview").toArray(), [], []);
}

export function useErrorLogs() {
  return useDbQuery((db) => db.errorLogs.orderBy("createdAt").reverse().toArray(), [], []);
}

export function useMockAttempts(testId?: string) {
  return useDbQuery(
    (db) => (testId ? db.mockAttempts.where("testId").equals(testId).reverse().sortBy("startedAt") : db.mockAttempts.orderBy("startedAt").reverse().toArray()),
    [testId],
    [],
  );
}

export function useRoadmap() {
  return useDbQuery((db) => db.roadmap.toArray(), [], []);
}

export function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const { db } = useUserData();
  const row = useDbQuery((d) => d.settings.get(key), [key], undefined);
  const value = row ? (row.value as T) : fallback;
  const set = useCallback((v: T) => {
    if (db) void db.settings.put({ key, value: v });
  }, [db, key]);
  return [value, set];
}

export function useViews() {
  return useDbQuery((db) => db.views.toArray(), [], []);
}
