import Link from "next/link";
import type { ReactNode } from "react";
import type { QuestionMeta } from "@/lib/content/types";
import { DifficultyBadge, OriginBadge, TypeBadge } from "@/components/question/badges";
import { SUBJECT_COLOR } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { StatusIcon } from "./StatusIcon";
import type { PyqState } from "./status";

export interface PyqRowProps {
  meta: QuestionMeta;
  topicName: string;
  subjectLabel: string;
  state: PyqState;
  /** Year · date · slot line; omitted where the paper is already clear (the paper page). */
  paperText?: string;
  /** Called just before navigation (stores the prev/next list). */
  onNavigate: () => void;
  /** Controls placed outside the link, e.g. the bookmark toggle. */
  trailing?: ReactNode;
  className?: string;
}

/** One PYQ in a list: status, number, paper, badges, preview and topic; the whole row opens the question. */
export function PyqRow({ meta, topicName, subjectLabel, state, paperText, onNavigate, trailing, className }: PyqRowProps) {
  return (
    <div className={cn("flex items-start border-b border-border bg-surface transition-colors hover:bg-surface-2", className)}>
      <Link
        href={`/questions/${meta.id}`}
        onClick={onNavigate}
        onAuxClick={onNavigate}
        className="flex min-w-0 flex-1 gap-3 px-3 py-3 focus-visible:rounded-md focus-visible:outline-offset-[-2px] sm:px-4"
      >
        <StatusIcon state={state} className="mt-px" />
        <span className="block min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tnum font-semibold text-fg">Q.{meta.questionNumber}</span>
            {paperText ? <span className="text-xs text-fg-3">{paperText}</span> : null}
          </span>
          <span className="mt-1 line-clamp-2 text-sm leading-5 text-fg-2">{meta.preview}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <OriginBadge origin={meta.origin} />
            <TypeBadge type={meta.type} marks={meta.marks} />
            <DifficultyBadge difficulty={meta.difficulty} />
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[meta.subjectId] }} />
              <span className="truncate">
                {subjectLabel} › {topicName}
              </span>
            </span>
          </span>
        </span>
      </Link>
      {trailing ? <div className="shrink-0 py-2 pr-2 sm:pr-3">{trailing}</div> : null}
    </div>
  );
}
