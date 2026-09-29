"use client";
import { useMemo } from "react";
import type { QuestionMeta } from "@/lib/content/types";
import { useQuestionStatuses } from "@/lib/userdata/hooks";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { PyqRow } from "@/components/pyq/PyqRow";
import { isAttempted, pyqState } from "@/components/pyq/status";
import { useStoreNavList } from "@/components/pyq/useNavList";
import { pyqTitle } from "@/components/pyq/data";
import { SUBJECT_SHORT } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

/** A topic's official PYQs (newest first) with the student's status; Previous / Next follow this list. */
export function TopicPyqList({ rows, topicName }: { rows: QuestionMeta[]; topicName: string }) {
  const statuses = useQuestionStatuses();
  const storeNavList = useStoreNavList();
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const attempted = ids.filter((id) => isAttempted(pyqState(statuses.get(id)))).length;
  const correct = ids.filter((id) => pyqState(statuses.get(id)) === "correct").length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-fg-2" role="status">
        {attempted ? (
          <>
            You have attempted <span className="tnum font-semibold text-fg">{attempted}</span> of <span className="tnum">{ids.length}</span>; <span className="tnum font-semibold text-fg">{correct}</span>{" "}
            correct on your latest attempt.
          </>
        ) : (
          <>Not attempted yet. Start with the newest paper; Previous / Next on each question follow this list.</>
        )}
      </p>
      <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {rows.map((q, i) => (
          <li key={q.id}>
            <PyqRow
              meta={q}
              topicName={topicName}
              subjectLabel={SUBJECT_SHORT[q.subjectId]}
              state={pyqState(statuses.get(q.id))}
              paperText={`GATE ${q.year}${q.examDate ? ` · ${formatDate(q.examDate)}` : ""}${q.session ? ` · Session ${q.session}` : ""}`}
              onNavigate={() => storeNavList(ids)}
              className={i === rows.length - 1 ? "border-b-0" : undefined}
              trailing={<BookmarkButton kind="question" refId={q.id} title={pyqTitle(q)} subjectId={q.subjectId} compact className="h-10 w-10 justify-center px-0" />}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
