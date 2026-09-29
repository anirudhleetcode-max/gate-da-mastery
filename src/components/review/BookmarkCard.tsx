"use client";
/**
 * One bookmark: what it is, when it was saved, the student's note (saved on
 * blur), open and remove. Question bookmarks carry a snapshot of the question
 * that is shown inline when the student is offline or the question cannot be
 * opened (e.g. its mock test was withdrawn for re-verification).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import type { BookmarkRow } from "@/lib/userdata/db";
import type { SubjectId } from "@/lib/content/schema";
import { useUserData } from "@/lib/userdata/hooks";
import { OriginBadge } from "@/components/question/badges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SUBJECT_SHORT } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { BlurField } from "./fields";
import { removeBookmark, updateBookmarkNote } from "./localOps";
import { SnapshotHtml } from "./SnapshotHtml";
import {
  KIND_LABEL,
  conceptHref,
  dayOf,
  formulaHref,
  isWithdrawnMockQuestion,
  originFromId,
  questionHref,
  safeInternalHref,
  strategyHref,
  unavailableReason,
} from "./shared";

export interface BookmarkLookup {
  formulaSubject: Readonly<Record<string, string>>;
  conceptIds: ReadonlySet<string>;
  strategyIds: ReadonlySet<string>;
  formulaIds: ReadonlySet<string>;
  availableMocks: ReadonlySet<string>;
}

/** The page a bookmark points to (always derived from its kind and id). */
function derivedHref(b: BookmarkRow, lookup: Pick<BookmarkLookup, "formulaSubject">): string {
  switch (b.kind) {
    case "question":
      return questionHref(b.refId);
    case "concept":
      return conceptHref(b.refId);
    case "formula":
      return formulaHref(b.refId, b.subjectId ?? lookup.formulaSubject[b.refId]);
    case "strategy":
      return strategyHref(b.refId);
  }
}

/** snapshot.href when it is a safe path on this site, otherwise the derived page. */
export function bookmarkHref(b: BookmarkRow, lookup: Pick<BookmarkLookup, "formulaSubject">): string {
  return safeInternalHref(b.snapshot?.href) ?? derivedHref(b, lookup);
}

/** Content that is no longer in the library (so the link would not open). */
function missingFromLibrary(b: BookmarkRow, lookup: BookmarkLookup): boolean {
  if (b.kind === "concept") return !lookup.conceptIds.has(b.refId);
  if (b.kind === "formula") return !lookup.formulaIds.has(b.refId);
  if (b.kind === "strategy") return !lookup.strategyIds.has(b.refId);
  return false;
}

type OpenProblem = "offline" | "unavailable" | "error" | null;

export function BookmarkCard({
  bookmark: b,
  lookup,
  online,
  onRemoved,
}: {
  bookmark: BookmarkRow;
  lookup: BookmarkLookup;
  online: boolean;
  /** Called after the bookmark was deleted (the card unmounts; the page moves focus). */
  onRemoved: (title: string) => void;
}) {
  const { db } = useUserData();
  const router = useRouter();
  const [copyToggle, setCopyToggle] = useState<boolean | null>(null);
  const [rawProblem, setProblem] = useState<OpenProblem>(null);
  const [opening, setOpening] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const href = bookmarkHref(b, lookup);
  const isQuestion = b.kind === "question";
  const kindLabel = KIND_LABEL[b.kind].toLowerCase();
  const withdrawn = isQuestion && isWithdrawnMockQuestion(b.refId, lookup.availableMocks);
  const missing = missingFromLibrary(b, lookup);
  // Only question bookmarks save a copy (the question text) for offline reading.
  const snapshot = isQuestion && typeof b.snapshot?.html === "string" && b.snapshot.html ? b.snapshot : null;
  // An "offline" failure clears itself once the connection is back.
  const problem: OpenProblem = rawProblem === "offline" && online ? null : rawProblem;
  // Offline (or after a failed open) the saved copy is shown without asking; the student can still hide it.
  const showCopy = Boolean(snapshot) && (copyToggle ?? (!online || problem !== null || withdrawn));
  const slug = b.key.replace(/[^a-zA-Z0-9-]/g, "-");
  const copyId = `bm-copy-${slug}`;
  const noteId = `bm-note-${slug}`;

  async function open(e: MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle new-tab / new-window clicks.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!navigator.onLine) {
      e.preventDefault();
      setProblem("offline");
      return;
    }
    setProblem(null);
    if (!isQuestion) return; // client-side navigation by <Link>
    // Check the question is being served before leaving the page, so a withdrawn
    // question shows the saved copy here instead of a "not found" page.
    e.preventDefault();
    setOpening(true);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(b.refId)}`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) router.push(href);
      else setProblem(res.status === 404 ? "unavailable" : "error");
    } catch {
      setProblem(navigator.onLine ? "error" : "offline");
    } finally {
      setOpening(false);
    }
  }

  async function remove() {
    if (!db) return;
    setBusy(true);
    try {
      await removeBookmark(db, b.key);
      onRemoved(b.title);
    } finally {
      setBusy(false);
    }
  }

  let message: string | null = null;
  if (missing) message = `This ${kindLabel} is not in the library right now, so its page cannot be opened.`;
  else if (problem === "offline") message = `You are offline, so this ${kindLabel} cannot be opened right now.`;
  else if (problem === "unavailable" || withdrawn) message = unavailableReason(b.refId);
  else if (problem === "error") message = "The question could not be opened (no answer from the server). Try again in a moment.";
  const copyNote =
    isQuestion && (problem !== null || withdrawn) ? (snapshot ? "Your saved copy of the question text is shown below." : "No copy of the question was saved with this bookmark.") : "";

  return (
    <li className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{KIND_LABEL[b.kind]}</Badge>
            {isQuestion ? <OriginBadge origin={originFromId(b.refId)} /> : null}
            {b.subjectId && SUBJECT_SHORT[b.subjectId as SubjectId] ? <Badge tone="outline">{SUBJECT_SHORT[b.subjectId as SubjectId]}</Badge> : null}
          </div>
          <div>
            <h3 className="break-words font-medium text-fg">{b.title}</h3>
            <p className="text-xs text-fg-3">
              Saved <time dateTime={b.createdAt}>{formatDate(dayOf(b.createdAt))}</time>
            </p>
          </div>

          <p role="status" className={message ? "text-sm text-warning" : "sr-only"}>
            {message ? `${message} ${copyNote}`.trim() : ""}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!withdrawn && !missing ? (
              <Link
                href={href}
                prefetch={false}
                onClick={open}
                aria-busy={opening || undefined}
                aria-label={`${opening ? "Opening" : "Open"}: ${b.title}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover dark:text-[#0e1117]"
              >
                {opening ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ExternalLink aria-hidden className="h-4 w-4" />}
                {opening ? "Opening…" : "Open"}
              </Link>
            ) : null}
            {snapshot ? (
              <Button
                onClick={() => setCopyToggle(!showCopy)}
                aria-expanded={showCopy}
                aria-controls={copyId}
                aria-label={`${showCopy ? "Hide" : "Show"} saved copy: ${b.title}`}
                className="h-10"
              >
                <FileText aria-hidden className="h-4 w-4" /> {showCopy ? "Hide saved copy" : "Show saved copy"}
              </Button>
            ) : null}
            {confirm ? (
              <span className="flex flex-wrap gap-2">
                <Button variant="danger" className="h-10" disabled={!db || busy} onClick={remove} aria-label={`Confirm removal: ${b.title}`}>
                  Confirm removal
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="h-10" disabled={!db} onClick={() => setConfirm(true)} aria-label={`Remove bookmark: ${b.title}`}>
                <Trash2 aria-hidden className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </div>

        <BlurField
          id={noteId}
          label="Your note"
          srContext={b.title}
          value={b.note ?? ""}
          multiline
          disabled={!db}
          placeholder="Why you saved it, what to remember"
          onSave={async (v) => {
            if (db) await updateBookmarkNote(db, b.key, v);
          }}
        />
      </div>

      {snapshot ? (
        <section id={copyId} hidden={!showCopy} aria-label={`Saved copy of ${b.title}`} className="min-w-0 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 sm:p-4">
          {showCopy ? (
            <>
              <p className="mb-2 text-xs text-fg-3">
                Saved copy of the question text from {formatDate(dayOf(snapshot.savedAt))}. Options, answers and solutions open with the full question page.
              </p>
              <SnapshotHtml html={snapshot.html} className="text-sm" />
            </>
          ) : null}
        </section>
      ) : null}
    </li>
  );
}
