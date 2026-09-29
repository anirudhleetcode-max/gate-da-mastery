"use client";
import { useState } from "react";
import { CalendarCheck, RotateCcw } from "lucide-react";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";
import { addToRevision, revisionKey } from "@/lib/userdata/ops";
import type { RevisionKind } from "@/lib/userdata/db";
import type { SubjectId } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

/**
 * "Add to revision" for a concept or formula. Once the item is in the spaced
 * revision queue the button stays in place (so keyboard focus is kept) but
 * reads "In revision" and does nothing: its schedule is managed on the
 * Revision page, and removing it here by accident would lose that history.
 */
export function RevisionButton({
  kind,
  refId,
  title,
  subjectId,
  topicId,
  label,
  compact = false,
  className,
}: {
  kind: RevisionKind;
  refId: string;
  title: string;
  subjectId?: SubjectId;
  topicId?: string;
  /** Accessible-name context for list rows, e.g. the formula name. */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { db } = useUserData();
  const key = revisionKey(kind, refId);
  const inQueue = useDbQuery(async (d) => (await d.revisionItems.get(key)) !== undefined, [key], false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!db || inQueue || busy) return;
    setBusy(true);
    try {
      await addToRevision(db, { kind, refId, title, subjectId, topicId, reason: "manual" });
      setMessage(`${label ?? title} was added to your revision queue. It is due today.`);
    } catch {
      setMessage("Could not save to the revision queue. Your browser may be blocking local storage.");
    } finally {
      setBusy(false);
    }
  }

  const text = inQueue ? "In revision" : "Add to revision";
  return (
    <>
      <button
        type="button"
        disabled={!db}
        aria-disabled={inQueue || busy || undefined}
        onClick={add}
        title={inQueue ? "Already in your revision queue (manage it on the Revision page)" : "Add to your spaced revision queue"}
        aria-label={label ? `${inQueue ? "In revision queue" : "Add to revision"}: ${label}` : inQueue ? "In revision queue" : undefined}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 sm:min-h-8",
          inQueue ? "cursor-default border-success/40 bg-success-soft text-success" : "border-border bg-surface text-fg-2 hover:bg-surface-2",
          className,
        )}
      >
        {inQueue ? <CalendarCheck aria-hidden className="h-4 w-4" /> : <RotateCcw aria-hidden className="h-4 w-4" />}
        {compact ? <span className="sr-only">{text}</span> : text}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
