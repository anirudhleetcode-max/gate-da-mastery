"use client";
/**
 * Three large recall buttons (Got it / Almost / Forgot). Each shows the
 * interval it would schedule, computed with the same scheduler that
 * gradeRevision uses, so the preview always matches the saved result.
 */
import { useMemo } from "react";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { review, type RecallGrade } from "@/lib/revision/schedule";
import type { RevisionItemRow } from "@/lib/userdata/db";
import { cn, formatDate } from "@/lib/utils";
import { GRADE_LABEL, dayToDate, relativeDay } from "./shared";

const GRADES: { grade: RecallGrade; icon: typeof CircleX; tone: string; help: string }[] = [
  { grade: "got_it", icon: CircleCheck, tone: "border-success/40 hover:bg-success-soft text-success", help: "Recalled it correctly" },
  { grade: "almost", icon: CircleDashed, tone: "border-warning/40 hover:bg-warning-soft text-warning", help: "Partly, or with effort" },
  { grade: "forgot", icon: CircleX, tone: "border-danger/40 hover:bg-danger-soft text-danger", help: "I could not recall it" },
];

function inDays(n: number) {
  return n === 1 ? "tomorrow" : `in ${n} days`;
}

export function RecallGrader({
  item,
  today,
  onGrade,
  disabled,
  prompt,
}: {
  item: RevisionItemRow;
  today: string;
  onGrade: (g: RecallGrade) => void;
  disabled?: boolean;
  prompt: string;
}) {
  const previews = useMemo(() => {
    const now = dayToDate(today);
    return Object.fromEntries(GRADES.map(({ grade }) => [grade, review(item, grade, now).intervalDays])) as Record<RecallGrade, number>;
  }, [item, today]);
  return (
    <fieldset className="rounded-[var(--radius)] border border-border bg-surface p-4 sm:p-5">
      <legend className="sr-only">Grade your recall</legend>
      <p className="mb-3 text-sm font-semibold text-fg" aria-hidden>
        Grade your recall
      </p>
      <p className="-mt-2 mb-3 text-sm text-fg-3">{prompt}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {GRADES.map(({ grade, icon: Icon, tone, help }) => (
          <button
            key={grade}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(grade)}
            aria-label={`${GRADE_LABEL[grade]}: ${help}. Next review ${inDays(previews[grade])}.`}
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-lg border-2 bg-surface px-4 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 sm:flex-col sm:items-start sm:gap-1",
              tone,
            )}
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <Icon aria-hidden className="h-5 w-5" />
              {GRADE_LABEL[grade]}
            </span>
            <span className="ml-auto text-right text-xs text-fg-2 sm:ml-0 sm:text-left">
              {help}
              <span className="block font-medium text-fg">Next review {inDays(previews[grade])}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Confirmation shown after grading. */
export function GradeResult({ grade, nextReview, today }: { grade: RecallGrade; nextReview: string; today: string }) {
  return (
    <p className="text-sm text-fg-2">
      Graded <strong className="text-fg">{GRADE_LABEL[grade]}</strong>. Next review: <strong className="text-fg">{formatDate(nextReview)}</strong> ({relativeDay(nextReview, today)}).
    </p>
  );
}
