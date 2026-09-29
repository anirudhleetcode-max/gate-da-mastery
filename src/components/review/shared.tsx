"use client";
/**
 * Helpers shared by the Revision, Error log and Bookmarks pages: live "today",
 * online status, media queries, load status for a user-data table, id-derived
 * question facts and labels.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { QuestionOrigin } from "@/lib/content/schema";
import { localDay, type GateDaDB, type RevisionItemRow, type RevisionReason } from "@/lib/userdata/db";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";
import type { RecallGrade } from "@/lib/revision/schedule";
import { Callout } from "@/components/ui/Callout";

// ------------------------------------------------------------------ external stores

function subscribeDay(cb: () => void) {
  const t = window.setInterval(cb, 60_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.clearInterval(t);
    document.removeEventListener("visibilitychange", cb);
  };
}

/** Local "YYYY-MM-DD" (null during server rendering); rolls over at midnight. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribeDay, () => localDay(), () => null);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** navigator.onLine as a live value (true on the server). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** Live media-query match (serverValue during server rendering and hydration). */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}

// ------------------------------------------------------------------ load status

export type LoadStatus = "loading" | "unavailable" | "ready";
type CountedTable = "revisionItems" | "errorLogs" | "bookmarks" | "attempts";

/**
 * Live hooks return [] until IndexedDB answers. A cheap live count tells
 * "still loading" apart from "really empty", so a returning student never
 * sees a false empty state.
 */
export function useTableStatus(table: CountedTable, loaded: readonly unknown[]): LoadStatus {
  const { ready, available } = useUserData();
  const count = useDbQuery<number | null>((db: GateDaDB) => db[table].count(), [table], null);
  if (ready && !available) return "unavailable";
  if (!ready || count === null) return "loading";
  if (count > 0 && loaded.length === 0) return "loading";
  return "ready";
}

export function StorageUnavailable({ what }: { what: string }) {
  return (
    <Callout tone="warning" title={`Your ${what} cannot be saved in this browser window`}>
      The browser is blocking local storage (IndexedDB), which usually happens in a private window or when site data is disabled. Everything on this platform is stored on your
      device, so open the site in a normal window to use your {what}.
    </Callout>
  );
}

export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius)] bg-surface-2" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-[var(--radius)] bg-surface-2" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ question ids

const PYQ_ID = /^DA\d{4}-S\d+-Q\d{2}$/;
const MOCK_Q_ID = /^M(\d{2})-Q\d+$/;

/** Official PYQ ids start with "DA20…" (e.g. DA2025-S1-Q14). */
export const isPyqId = (id: string) => /^DA20/.test(id);

/** Origin of a question from its id (bookmark and revision rows do not store it). */
export function originFromId(id: string): QuestionOrigin {
  if (PYQ_ID.test(id)) return "OFFICIAL_PYQ";
  if (MOCK_Q_ID.test(id)) return "MOCK_TEST";
  return "ORIGINAL_PRACTICE";
}

/** "M04-Q12" → "mock-04"; null for non-mock ids. */
export function mockIdOf(questionId: string): string | null {
  const m = MOCK_Q_ID.exec(questionId);
  return m ? `mock-${m[1]}` : null;
}

/**
 * A mock question is served only while its whole mock is available (fully
 * verified). Returns true when the question's mock is currently withdrawn.
 */
export function isWithdrawnMockQuestion(questionId: string, availableMocks: ReadonlySet<string>): boolean {
  const mock = mockIdOf(questionId);
  return mock !== null && !availableMocks.has(mock);
}

/** Why the question API does not serve a question (a 404), in words for the student. */
export function unavailableReason(questionId: string): string {
  return originFromId(questionId) === "MOCK_TEST"
    ? "This question is not being served right now: mock-test questions are withdrawn while their mock is re-verified, and return once every question in that mock has passed review again."
    : "This question is not being served right now: a question is withdrawn while it is re-checked, and returns once it has passed review again.";
}

// ------------------------------------------------------------------ dates

export function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

export function shiftDay(day: string, n: number): string {
  const d = dayToDate(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToDate(to).getTime() - dayToDate(from).getTime()) / 86_400_000);
}

/** "today" / "tomorrow" / "in 5 days" / "3 days ago". */
export function relativeDay(day: string, today: string): string {
  const n = daysBetween(today, day);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function dueLabel(nextReview: string, today: string): { text: string; tone: "danger" | "warning" | "neutral" } {
  const n = daysBetween(today, nextReview);
  if (n < 0) return { text: `Overdue ${-n} ${n === -1 ? "day" : "days"}`, tone: "danger" };
  if (n === 0) return { text: "Due today", tone: "warning" };
  if (n === 1) return { text: "Due tomorrow", tone: "neutral" };
  return { text: `Due in ${n} days`, tone: "neutral" };
}

/** Local day of an ISO date-time. */
export const dayOf = (iso: string) => localDay(new Date(iso));

// ------------------------------------------------------------------ labels & links

export const REASON_LABEL: Record<RevisionReason, string> = {
  incorrect: "Answered incorrectly",
  difficult: "Marked difficult",
  bookmarked: "Bookmarked",
  manual: "Added by you",
  weak_topic: "Weak topic",
};

export const GRADE_LABEL: Record<RecallGrade, string> = {
  forgot: "Forgot",
  almost: "Almost",
  got_it: "Got it",
};

export const KIND_LABEL = { question: "Question", concept: "Concept", formula: "Formula", strategy: "Strategy" } as const;

/*
 * Ids in user rows come from IndexedDB (or an imported backup file), so they
 * are encoded before they become part of a path: "../x" or "a?b" can never
 * change which route a link opens.
 */
const seg = (id: string) => encodeURIComponent(id);

export const questionHref = (id: string) => `/questions/${seg(id)}`;
export const conceptHref = (id: string) => `/concepts/${seg(id)}`;
export const strategyHref = (id: string) => `/strategy/${seg(id)}`;
export const formulaHref = (id: string, subjectId: string | undefined) => (subjectId ? `/formulas/${seg(subjectId)}#${seg(id)}` : "/formulas");

/** Where a revision item lives. */
export function revisionHref(r: Pick<RevisionItemRow, "kind" | "refId" | "subjectId">): string {
  if (r.kind === "question") return questionHref(r.refId);
  if (r.kind === "concept") return conceptHref(r.refId);
  return formulaHref(r.refId, r.subjectId);
}

/**
 * A stored link (e.g. a bookmark snapshot's href) is used only when it is a
 * plain path on this site: never another origin, a protocol-relative URL or
 * a javascript: URL from a tampered backup file.
 */
export function safeInternalHref(href: string | undefined): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  if (!/^\/(?![/\\])[^\s\\]*$/.test(v)) return null;
  try {
    const u = new URL(v, "https://internal.invalid");
    return u.origin === "https://internal.invalid" ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}
