"use client";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useUserData, useBookmarkKeys } from "@/lib/userdata/hooks";
import { toggleBookmark, bookmarkKey } from "@/lib/userdata/ops";
import type { BookmarkKind } from "@/lib/userdata/db";
import type { SubjectId } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  kind,
  refId,
  title,
  subjectId,
  snapshot,
  className,
  compact = false,
  label,
}: {
  kind: BookmarkKind;
  refId: string;
  title: string;
  subjectId?: SubjectId;
  snapshot?: { html: string; href: string };
  className?: string;
  compact?: boolean;
  /** Accessible name context, e.g. "Q.12, GATE DA 2026" (important in compact list rows). */
  label?: string;
}) {
  const { db } = useUserData();
  const keys = useBookmarkKeys();
  const on = keys.has(bookmarkKey(kind, refId));
  return (
    <button
      type="button"
      disabled={!db}
      aria-pressed={on}
      onClick={() => db && toggleBookmark(db, { kind, refId, title, subjectId, snapshot: snapshot ? { ...snapshot, savedAt: new Date().toISOString() } : undefined })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
        on ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface text-fg-2 hover:bg-surface-2",
        className,
      )}
      title={on ? "Remove bookmark" : "Bookmark"}
      aria-label={label ? `${on ? "Remove bookmark" : "Bookmark"}: ${label}` : undefined}
    >
      {on ? <BookmarkCheck aria-hidden className="h-4 w-4" /> : <Bookmark aria-hidden className="h-4 w-4" />}
      {compact ? <span className="sr-only">{on ? "Bookmarked" : "Bookmark"}</span> : on ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
