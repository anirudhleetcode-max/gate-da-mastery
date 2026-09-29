"use client";
/** Revision queue rows: what the item is, why it is queued, when it is due, and actions. */
import Link from "next/link";
import { useState } from "react";
import { Play, Trash2 } from "lucide-react";
import type { RevisionItemRow } from "@/lib/userdata/db";
import { isFrequentlyForgotten } from "@/lib/revision/schedule";
import { OriginBadge } from "@/components/question/badges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SUBJECT_SHORT } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { GRADE_LABEL, KIND_LABEL, REASON_LABEL, dueLabel, isWithdrawnMockQuestion, originFromId, revisionHref } from "./shared";

export interface RowContext {
  today: string;
  topicName: ReadonlyMap<string, string>;
  weakTopics: ReadonlySet<string>;
  highWeight: ReadonlyMap<string, { marks: number }>;
  availableMocks: ReadonlySet<string>;
  onReview: (key: string) => void;
  onRemove: (key: string) => Promise<void>;
  canEdit: boolean;
}

const PAGE = 50;

export function RevisionItemList({ items, ctx, label }: { items: RevisionItemRow[]; ctx: RowContext; label: string }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  return (
    <>
      <ul aria-label={label} className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
        {shown.map((it) => (
          <RevisionItem key={it.key} item={it} ctx={ctx} />
        ))}
      </ul>
      {items.length > shown.length ? (
        <div className="mt-3 flex justify-center">
          <Button onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, items.length - shown.length)} more ({items.length - shown.length} not shown)
          </Button>
        </div>
      ) : null}
    </>
  );
}

function RevisionItem({ item, ctx }: { item: RevisionItemRow; ctx: RowContext }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const due = dueLabel(item.nextReview, ctx.today);
  const topic = item.topicId ? ctx.topicName.get(item.topicId) : undefined;
  const high = item.topicId ? ctx.highWeight.get(item.topicId) : undefined;
  const withdrawn = item.kind === "question" && isWithdrawnMockQuestion(item.refId, ctx.availableMocks);
  const forgotten = isFrequentlyForgotten(item);
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.kind === "question" ? <OriginBadge origin={originFromId(item.refId)} /> : <Badge tone="info">{KIND_LABEL[item.kind]}</Badge>}
          <Badge tone={due.tone}>{due.text}</Badge>
          {forgotten ? <Badge tone="danger">Frequently forgotten</Badge> : null}
          {item.topicId && ctx.weakTopics.has(item.topicId) ? <Badge tone="warning">Weak topic</Badge> : null}
          {high ? (
            <Badge tone="outline" title={`${high.marks} marks in the official GATE DA papers so far`}>
              Historically high-weight
            </Badge>
          ) : null}
        </div>
        {withdrawn ? (
          <p className="mt-1 font-medium text-fg">{item.title}</p>
        ) : (
          <Link href={revisionHref(item)} className="mt-1 inline-block font-medium text-fg hover:underline">
            {item.title}
          </Link>
        )}
        <p className="mt-0.5 text-xs text-fg-3">
          {[item.subjectId ? SUBJECT_SHORT[item.subjectId] : null, topic].filter(Boolean).join(" · ")}
          {item.subjectId || topic ? " · " : ""}
          {item.reasons.map((r) => REASON_LABEL[r]).join(", ")}
        </p>
        <p className="mt-0.5 text-xs text-fg-3">
          {item.reviewCount ? `Reviewed ${plural(item.reviewCount, "time")}` : "Not reviewed yet"}
          {item.confidence ? ` · last: ${GRADE_LABEL[item.confidence]}` : ""}
          {item.lapses ? ` · forgotten ${plural(item.lapses, "time")}` : ""}
          {item.reviewCount ? ` · interval ${plural(item.intervalDays, "day")}` : ""}
        </p>
        {withdrawn ? (
          <p className="mt-1 text-xs text-warning">Temporarily unavailable: its mock test is being re-verified. It returns once every question in that mock has passed review.</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirm ? (
          <>
            <Button
              size="sm"
              variant="danger"
              disabled={busy || !ctx.canEdit}
              className="max-sm:h-10"
              onClick={async () => {
                setBusy(true);
                try {
                  await ctx.onRemove(item.key);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm removal
            </Button>
            <Button size="sm" variant="ghost" className="max-sm:h-10" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="max-sm:h-10" disabled={!ctx.canEdit} onClick={() => ctx.onReview(item.key)} aria-label={`Review now: ${item.title}`}>
              <Play aria-hidden className="h-3.5 w-3.5" /> Review
            </Button>
            <Button size="sm" variant="ghost" className="max-sm:h-10" disabled={!ctx.canEdit} onClick={() => setConfirm(true)} aria-label={`Remove from revision: ${item.title}`}>
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
