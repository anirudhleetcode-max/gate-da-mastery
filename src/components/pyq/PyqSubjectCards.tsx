"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { SubjectId } from "@/lib/content/schema";
import { useQuestionStatuses, useUserData } from "@/lib/userdata/hooks";
import { SUBJECT_COLOR } from "@/lib/labels";
import { formatMarks, plural } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/Progress";
import { isAttempted, pyqState } from "./status";

export interface SubjectPyqSummary {
  id: SubjectId;
  name: string;
  ids: string[];
  marks: number;
  byType: { MCQ: number; MSQ: number; NAT: number };
  byYear: { year: number; count: number; marks: number }[];
}

/** Subject cards with PYQ counts, marks and the student's own completion (distinct PYQs attempted). */
export function PyqSubjectCards({ subjects }: { subjects: SubjectPyqSummary[] }) {
  const statuses = useQuestionStatuses();
  const { ready, available } = useUserData();
  const done = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subjects) m.set(s.id, s.ids.filter((id) => isAttempted(pyqState(statuses.get(id)))).length);
    return m;
  }, [subjects, statuses]);
  const total = subjects.reduce((a, s) => a + s.ids.length, 0);
  const totalDone = [...done.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
        <p className="text-sm text-fg-2">
          <span className="font-medium text-fg">Your PYQ completion:</span>{" "}
          {totalDone ? (
            <>
              <span className="tnum font-semibold text-fg">{totalDone}</span> of <span className="tnum">{total}</span> questions attempted
            </>
          ) : ready && !available ? (
            "progress cannot be saved in this browser window."
          ) : (
            <>none of the {total} questions attempted yet. Open any question below to start; your progress is saved on this device.</>
          )}
        </p>
        {totalDone ? <ProgressBar value={totalDone} max={total} label="Your PYQ completion" showValue className="min-w-40 flex-1" /> : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {subjects.map((s) => {
          const n = s.ids.length;
          const d = done.get(s.id) ?? 0;
          return (
            <li key={s.id} className="relative flex flex-col rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)] transition-colors has-[a:hover]:border-border-strong">
              <h3 className="flex items-start gap-2 text-[0.95rem] font-semibold leading-snug text-fg">
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[s.id] }} />
                {n ? (
                  <Link href={`/pyqs/browse?subject=${s.id}`} className="after:absolute after:inset-0 after:rounded-[var(--radius)] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-[color:var(--focus)] focus-visible:after:outline-offset-2">
                    {s.name}
                  </Link>
                ) : (
                  s.name
                )}
              </h3>
              {n ? (
                <>
                  <p className="mt-2 text-sm text-fg-2">
                    <span className="tnum font-semibold text-fg">{n}</span> {n === 1 ? "question" : "questions"} · <span className="tnum font-semibold text-fg">{formatMarks(s.marks)}</span> marks
                  </p>
                  <p className="tnum mt-0.5 text-xs text-fg-3">
                    MCQ {s.byType.MCQ} · MSQ {s.byType.MSQ} · NAT {s.byType.NAT}
                  </p>
                  {s.byYear.length ? (
                    <dl aria-label="Marks by year" className="mt-2 grid gap-1 rounded-md bg-surface-2 px-2 py-1.5 text-center text-xs" style={{ gridTemplateColumns: `repeat(${s.byYear.length}, minmax(0, 1fr))` }}>
                      {s.byYear.map((y) => (
                        <div key={y.year} className="min-w-0">
                          <dt className="tnum text-fg-3">{y.year}</dt>
                          <dd className="tnum font-medium text-fg-2">
                            {formatMarks(y.marks)}
                            <span className="font-normal text-fg-3"> marks</span>
                            <span className="sr-only">, {plural(y.count, "question")}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <div className="mt-auto pt-3">
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-fg-3">Your completion</span>
                      <span className="tnum text-fg-2">
                        {d} / {n}
                      </span>
                    </div>
                    <ProgressBar value={d} max={n} label={`Your completion in ${s.name}: ${d} of ${plural(n, "question")} attempted`} tone={d === n ? "success" : "accent"} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-fg-3">No questions from this subject are in the question bank yet.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
