"use client";
import Link from "next/link";
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import type { RevisionItemRow, RevisionReason } from "@/lib/userdata/db";
import { useRevisionItems } from "@/lib/userdata/hooks";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, plural } from "@/lib/utils";
import { useToday } from "../hooks";
import { DataStatusNote, type PanelProps } from "./common";

const REASON_LABEL: Record<RevisionReason, string> = {
  incorrect: "Answered incorrectly",
  difficult: "Marked difficult",
  bookmarked: "Bookmarked",
  manual: "Added by you",
  weak_topic: "Weak topic",
};
const KIND_LABEL: Record<RevisionItemRow["kind"], string> = { question: "Question", concept: "Concept", formula: "Formula" };
const GRADE_LABEL = { forgot: "Forgot", almost: "Almost", got_it: "Got it" } as const;

function itemHref(r: RevisionItemRow, subjectId: string) {
  if (r.kind === "concept") return `/concepts/${r.refId}`;
  if (r.kind === "formula") return `/formulas/${r.subjectId ?? subjectId}#${r.refId}`;
  return `/questions/${r.refId}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

export function RevisionPanel({ data, status }: PanelProps) {
  const s = data.subject;
  const all = useRevisionItems();
  const today = useToday();
  const topicName = useMemo(() => new Map(data.topics.map((t) => [t.id, t.name])), [data.topics]);
  // The queue is ordered by next review date, so due items come first.
  const items = useMemo(() => all.filter((r) => r.subjectId === s.id), [all, s.id]);
  const due = today ? items.filter((r) => r.nextReview <= today).length : 0;

  if (status !== "ready") return <DataStatusNote status={status} />;
  if (!items.length)
    return (
      <EmptyState title={`Nothing from ${s.name} is in your revision queue`} action={<ButtonLink href="/revision">Open revision</ButtonLink>}>
        Questions you answer incorrectly are added automatically, and you can add any question, concept or formula yourself. Items come back on a spaced schedule until you recall them reliably.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-2" role="status">
          <span className="tnum font-semibold text-fg">{due}</span> due now · <span className="tnum">{items.length - due}</span> scheduled later ({plural(items.length, "item")} from {s.name})
        </p>
        <ButtonLink href="/revision" variant={due ? "primary" : "secondary"} size="sm">
          <RotateCcw aria-hidden className="h-4 w-4" /> {due ? "Review due items" : "Open revision"}
        </ButtonLink>
      </div>
      <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {items.map((r) => {
          const diff = today ? daysBetween(today, r.nextReview) : 0;
          const isDue = diff <= 0;
          return (
            <li key={r.key} className="flex flex-col gap-1.5 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="outline">{KIND_LABEL[r.kind]}</Badge>
                  <Link href={itemHref(r, s.id)} className="min-w-0 font-medium text-fg hover:underline">
                    {r.title}
                  </Link>
                </div>
                <p className="mt-1 text-xs text-fg-3">
                  {r.topicId ? `${topicName.get(r.topicId) ?? r.topicId} · ` : ""}
                  {r.reasons.map((x) => REASON_LABEL[x] ?? x).join(", ")}
                  {r.reviewCount ? ` · reviewed ${plural(r.reviewCount, "time")}` : " · not reviewed yet"}
                  {r.confidence ? ` · last: ${GRADE_LABEL[r.confidence]}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-sm">
                {isDue ? (
                  <Badge tone={diff < 0 ? "danger" : "warning"}>{diff < 0 ? `Overdue by ${plural(-diff, "day")}` : "Due today"}</Badge>
                ) : (
                  <span className="text-fg-3">
                    Next review <span className="tnum text-fg-2">{formatDate(r.nextReview)}</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
