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
  /** A control placed outside the link at the top right, e.g. the bookmark toggle (40×40). */
  trailing?: ReactNode;
  className?: string;
}

/** One PYQ in a list: status, number, paper, preview, badges and topic; the whole row opens the question. */
export function PyqRow({ meta, topicName, subjectLabel, state, paperText, onNavigate, trailing, className }: PyqRowProps) {
  return (
    <div className={cn("relative border-b border-border bg-surface transition-colors hover:bg-surface-2", className)}>
      <Link
        href={`/questions/${meta.id}`}
        onClick={onNavigate}
        onAuxClick={onNavigate}
        className="flex min-w-0 gap-3 px-3 py-3 focus-visible:rounded-md focus-visible:outline-offset-[-2px] sm:px-4"
      >
        <StatusIcon state={state} className="mt-px" />
        <span className="block min-w-0 flex-1">
          <span className={cn("flex min-h-6 flex-wrap items-baseline gap-x-2 gap-y-0.5", trailing && "min-h-8 pr-11 sm:min-h-6")}>
            <span className="tnum font-semibold text-fg">Q.{meta.questionNumber}</span>
            {paperText ? <span className="text-xs text-fg-3">{paperText}</span> : null}
          </span>
          <span className={cn("mt-0.5 line-clamp-2 text-sm leading-5 text-fg-2", trailing && "sm:pr-11")}>{meta.preview}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <OriginBadge origin={meta.origin} />
            <TypeBadge type={meta.type} marks={meta.marks} />
            <DifficultyBadge difficulty={meta.difficulty} />
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs text-fg-3">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[meta.subjectId] }} />
              <span className="truncate">
                {subjectLabel} › {topicName}
              </span>
            </span>
          </span>
        </span>
      </Link>
      {trailing ? <div className="absolute right-2 top-1.5 sm:right-3">{trailing}</div> : null}
    </div>
  );
}
