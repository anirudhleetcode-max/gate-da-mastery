"use client";
/**
 * One bookmark: what it is, when it was saved, the student's note (saved on
 * blur), open and remove. Question bookmarks carry a snapshot of the question
 * that is shown inline when the student is offline or the question cannot be
 * opened (e.g. its mock test was withdrawn for re-verification).
 */
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
import { cn, formatDate } from "@/lib/utils";
import { BlurField } from "./fields";
import { removeBookmark, updateBookmarkNote } from "./localOps";
import { SnapshotHtml } from "./SnapshotHtml";
import { KIND_LABEL, dayOf, isWithdrawnMockQuestion, originFromId } from "./shared";

export interface BookmarkLookup {
  formulaSubject: Readonly<Record<string, string>>;
  conceptIds: ReadonlySet<string>;
  strategyIds: ReadonlySet<string>;
  formulaIds: ReadonlySet<string>;
  availableMocks: ReadonlySet<string>;
}

/** snapshot.href when present, otherwise the page the bookmark points to. */
export function bookmarkHref(b: BookmarkRow, lookup: Pick<BookmarkLookup, "formulaSubject">): string {
  if (b.snapshot?.href) return b.snapshot.href;
  switch (b.kind) {
    case "question":
      return `/questions/${b.refId}`;
    case "concept":
      return `/concepts/${b.refId}`;
    case "formula": {
      const subject = b.subjectId ?? lookup.formulaSubject[b.refId];
      return subject ? `/formulas/${subject}#${b.refId}` : "/formulas";
    }
    case "strategy":
      return `/strategy/${b.refId}`;
  }
}

/** Content that is no longer in the library (so the link would not open). */
function missingFromLibrary(b: BookmarkRow, lookup: BookmarkLookup): boolean {
  if (b.kind === "concept") return !lookup.conceptIds.has(b.refId);
  if (b.kind === "formula") return !lookup.formulaIds.has(b.refId);
  if (b.kind === "strategy") return !lookup.strategyIds.has(b.refId);
  return false;
}

type OpenProblem = "offline" | "unavailable" | "error" | null;

export function BookmarkCard({ bookmark: b, lookup, online }: { bookmark: BookmarkRow; lookup: BookmarkLookup; online: boolean }) {
  const { db } = useUserData();
  const router = useRouter();
  const [copyToggle, setCopyToggle] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<OpenProblem>(null);
  const [opening, setOpening] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const href = bookmarkHref(b, lookup);
  const isQuestion = b.kind === "question";
  const withdrawn = isQuestion && isWithdrawnMockQuestion(b.refId, lookup.availableMocks);
  const missing = missingFromLibrary(b, lookup);
  const snapshot = b.snapshot?.html ? b.snapshot : null;
  // Offline (or after a failed open) the saved copy is shown without asking; the student can still hide it.
  const showCopy = Boolean(snapshot) && (copyToggle ?? (!online || problem !== null || withdrawn));
  const copyId = `bm-copy-${b.key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const noteId = `bm-note-${b.key.replace(/[^a-zA-Z0-9-]/g, "-")}`;

  async function open(e: MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle new-tab / new-window clicks.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!online) {
      e.preventDefault();
      setProblem("offline");
      return;
    }
    if (!isQuestion) return;
    e.preventDefault();
    setOpening(true);
    setProblem(null);
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

  const message =
    problem === "offline"
      ? "You are offline, so the question page cannot load."
      : problem === "unavailable" || withdrawn
        ? "This question is temporarily unavailable: mock-test questions are withdrawn while their mock is re-verified, and return once every question in it has passed review."
        : problem === "error"
          ? "The question could not be opened (no answer from the server)."
          : null;

  return (
    <li className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{KIND_LABEL[b.kind]}</Badge>
            {isQuestion ? <OriginBadge origin={originFromId(b.refId)} /> : null}
            {b.subjectId ? <Badge tone="outline">{SUBJECT_SHORT[b.subjectId as SubjectId] ?? b.subjectId}</Badge> : null}
          </div>
          <div>
            <h3 className="font-medium text-fg">{b.title}</h3>
            <p className="text-xs text-fg-3">
              Saved <time dateTime={b.createdAt}>{formatDate(dayOf(b.createdAt))}</time>
            </p>
          </div>

          {message || missing ? (
            <p role="status" className="text-sm text-warning">
              {missing ? `This ${KIND_LABEL[b.kind].toLowerCase()} is not in the library right now, so its page cannot be opened.` : message}{" "}
              {snapshot && (problem || withdrawn) ? "Your saved copy is shown below." : isQuestion && !snapshot && (problem || withdrawn) ? "No copy was saved with this bookmark." : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!withdrawn && !missing ? (
              <a
                href={href}
                onClick={open}
                aria-busy={opening || undefined}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover dark:text-[#0e1117]"
              >
                {opening ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ExternalLink aria-hidden className="h-4 w-4" />}
                {opening ? "Opening…" : "Open"}
                <span className="sr-only">: {b.title}</span>
              </a>
            ) : null}
            {snapshot ? (
              <Button onClick={() => setCopyToggle(!showCopy)} aria-expanded={showCopy} aria-controls={copyId} className="h-10">
                <FileText aria-hidden className="h-4 w-4" /> {showCopy ? "Hide saved copy" : "Show saved copy"}
              </Button>
            ) : null}
            {confirm ? (
              <span className="flex flex-wrap gap-2">
                <Button variant="danger" className="h-10" disabled={!db} onClick={() => db && removeBookmark(db, b.key)}>
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
        <section id={copyId} hidden={!showCopy} aria-label={`Saved copy of ${b.title}`} className={cn("rounded-lg border border-border bg-surface-2 p-3 sm:p-4")}>
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
