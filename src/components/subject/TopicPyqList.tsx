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
import { useDataStatus } from "./hooks";

export type PyqListRow = QuestionMeta & { topicName: string };

/**
 * Official PYQs (newest first) with the student's status; Previous / Next on
 * each question follow this list. `kind="related"` is the list of questions
 * filed under other topics that also test this topic's syllabus phrases.
 */
export function TopicPyqList({ rows, kind = "topic" }: { rows: PyqListRow[]; kind?: "topic" | "related" }) {
  const statuses = useQuestionStatuses();
  const status = useDataStatus();
  const storeNavList = useStoreNavList();
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const attempted = ids.filter((id) => isAttempted(pyqState(statuses.get(id)))).length;
  const correct = ids.filter((id) => pyqState(statuses.get(id)) === "correct").length;

  return (
    <div className="space-y-2">
      {kind === "topic" ? (
        <p className="text-sm text-fg-2" role="status">
          {status !== "ready" ? (
            "Newest paper first. Previous / Next on each question follow this list."
          ) : attempted ? (
            <>
              You have attempted <span className="tnum font-semibold text-fg">{attempted}</span> of <span className="tnum">{ids.length}</span>;{" "}
              <span className="tnum font-semibold text-fg">{correct}</span> correct on your latest attempt.
            </>
          ) : (
            "Not attempted yet. Start with the newest paper; Previous / Next on each question follow this list."
          )}
        </p>
      ) : null}
      <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {rows.map((q, i) => (
          <li key={q.id}>
            <PyqRow
              meta={q}
              topicName={q.topicName}
              subjectLabel={SUBJECT_SHORT[q.subjectId]}
              state={pyqState(statuses.get(q.id))}
              paperText={`GATE ${q.year}${q.examDate ? ` · ${formatDate(q.examDate)}` : ""}${q.session ? ` · Session ${q.session}` : ""}`}
              onNavigate={() => storeNavList(ids)}
              className={i === rows.length - 1 ? "border-b-0" : undefined}
              trailing={<BookmarkButton kind="question" refId={q.id} title={pyqTitle(q)} label={pyqTitle(q)} subjectId={q.subjectId} compact className="h-10 w-10 justify-center px-0" />}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
