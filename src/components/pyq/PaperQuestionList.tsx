"use client";
import { useMemo } from "react";
import type { QuestionMeta } from "@/lib/content/types";
import { useQuestionStatuses } from "@/lib/userdata/hooks";
import { SUBJECT_SHORT } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { marksLabel, pyqTitle } from "./data";
import { PyqRow } from "./PyqRow";
import { isAttempted, pyqState } from "./status";
import { useStoreNavList } from "./useNavList";

export interface PaperSection {
  key: "GA" | "DA";
  title: string;
  rows: { meta: QuestionMeta; topicName: string }[];
  /** Official question numbers in this section that are not in the question bank yet. */
  missing: number[];
}

/** "60, 61, 62, 64" → "Q.60–Q.62, Q.64" */
function ranges(ns: number[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < ns.length) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(j > i ? `Q.${ns[i]}–Q.${ns[j]}` : `Q.${ns[i]}`);
    i = j + 1;
  }
  return out.join(", ");
}

/** The paper's questions in official order, grouped by section, with the student's status. */
export function PaperQuestionList({ sections }: { sections: PaperSection[] }) {
  const statuses = useQuestionStatuses();
  const storeNavList = useStoreNavList();
  const ids = useMemo(() => sections.flatMap((s) => s.rows.map((r) => r.meta.id)), [sections]);
  const states = useMemo(() => new Map(ids.map((id) => [id, pyqState(statuses.get(id))])), [ids, statuses]);
  const attempted = ids.filter((id) => isAttempted(states.get(id)!)).length;
  const correct = ids.filter((id) => states.get(id) === "correct").length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-2">
        {attempted ? (
          <>
            You have attempted <span className="tnum font-semibold text-fg">{attempted}</span> of the <span className="tnum">{ids.length}</span> loaded questions in this paper;{" "}
            <span className="tnum font-semibold text-fg">{correct}</span> are solved correctly on your latest attempt.
          </>
        ) : (
          <>You have not attempted any question from this paper yet. Open Q.1 to work through it in official order; Previous / Next on each question follow this list.</>
        )}
      </p>
      {sections.map((s) => {
        const marks = s.rows.reduce((a, r) => a + r.meta.marks, 0);
        return (
          <section key={s.key} aria-labelledby={`sec-${s.key}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 id={`sec-${s.key}`} className="text-base font-semibold text-fg">
                {s.title}
              </h3>
              <p className="tnum text-xs text-fg-3">
                {plural(s.rows.length, "question")} loaded · {marksLabel(marks)}
              </p>
            </div>
            {s.rows.length ? (
              <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
                {s.rows.map((r, i) => (
                  <li key={r.meta.id}>
                    <PyqRow
                      meta={r.meta}
                      topicName={r.topicName}
                      subjectLabel={SUBJECT_SHORT[r.meta.subjectId]}
                      state={states.get(r.meta.id) ?? "unattempted"}
                      onNavigate={() => storeNavList(ids)}
                      className={i === s.rows.length - 1 ? "border-b-0" : undefined}
                      trailing={<BookmarkButton kind="question" refId={r.meta.id} title={pyqTitle(r.meta)} subjectId={r.meta.subjectId} compact className="h-10 w-10 justify-center px-0" />}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-[var(--radius)] border border-dashed border-border-strong bg-surface px-4 py-5 text-center text-sm text-fg-3">
                No question from this section is in the question bank yet.
              </p>
            )}
            {s.missing.length && s.rows.length ? (
              <p className="mt-2 text-xs text-fg-3">Not in the question bank yet: {ranges(s.missing)}.</p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
