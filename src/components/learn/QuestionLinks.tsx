"use client";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useQuestionStatuses } from "@/lib/userdata/hooks";
import { useStorageValue } from "@/lib/useStorage";
import { NAV_LIST_KEY } from "@/lib/navList";
import { SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { PyqRow } from "@/components/pyq/PyqRow";
import { StatusIcon } from "@/components/pyq/StatusIcon";
import { isAttempted, pyqState } from "@/components/pyq/status";
import { DifficultyBadge, OriginBadge, TypeBadge } from "@/components/question/badges";
import type { QuestionRow } from "./types";

/** Stores the ordered ids so Previous / Next on the question page walk this list. */
function useStoreList(ids: string[]) {
  const [, set] = useStorageValue(NAV_LIST_KEY, "session");
  return useCallback(() => set(JSON.stringify(ids)), [set, ids]);
}

/** Official PYQs that test a concept, newest paper first, with the student's own status. */
export function ConceptPyqList({ rows }: { rows: QuestionRow[] }) {
  const statuses = useQuestionStatuses();
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const store = useStoreList(ids);
  const attempted = ids.filter((id) => isAttempted(pyqState(statuses.get(id)))).length;
  const correct = ids.filter((id) => pyqState(statuses.get(id)) === "correct").length;
  return (
    <div className="space-y-2">
      <p className="px-1 text-sm text-fg-2 sm:px-0">
        {attempted ? (
          <>
            You have attempted <span className="tnum font-semibold text-fg">{attempted}</span> of <span className="tnum">{ids.length}</span>;{" "}
            <span className="tnum font-semibold text-fg">{correct}</span> correct on your latest attempt.
          </>
        ) : (
          "Newest paper first. Previous / Next on each question follow this list."
        )}
      </p>
      <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {rows.map((q, i) => (
          <li key={q.id}>
            <PyqRow
              meta={q}
              topicName={q.topicName}
              subjectLabel={SUBJECT_SHORT[q.subjectId]}
              state={pyqState(statuses.get(q.id))}
              paperText={`GATE ${q.year}${q.examDate ? ` · ${formatDate(q.examDate)}` : ""}${q.session ? ` · Session ${q.session}` : ""}`}
              onNavigate={store}
              className={i === rows.length - 1 ? "border-b-0" : undefined}
            />
          </li>
        ))}
      </ol>
      <p className="px-1 text-xs text-fg-3 sm:px-0">Difficulty labels are platform estimates; GATE does not publish difficulty levels.</p>
    </div>
  );
}

/** Original practice questions for a concept (verified questions only reach this list). */
export function ConceptPracticeList({ rows }: { rows: QuestionRow[] }) {
  const statuses = useQuestionStatuses();
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const store = useStoreList(ids);
  return (
    <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
      {rows.map((q, i) => (
        <li key={q.id} className={cn("border-b border-border", i === rows.length - 1 && "border-b-0")}>
          <Link
            href={`/questions/${q.id}`}
            onClick={store}
            onAuxClick={store}
            className="flex min-w-0 gap-3 px-3 py-3 transition-colors hover:bg-surface-2 focus-visible:rounded-md focus-visible:outline-offset-[-2px] sm:px-4"
          >
            <StatusIcon state={pyqState(statuses.get(q.id))} className="mt-px" />
            <span className="block min-w-0 flex-1">
              <span className="font-semibold text-fg">Practice question {i + 1}</span>
              <span className="mt-0.5 line-clamp-2 text-sm leading-5 text-fg-2">{q.preview}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <OriginBadge origin={q.origin} />
                <TypeBadge type={q.type} marks={q.marks} />
                <DifficultyBadge difficulty={q.difficulty} estimated={false} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
