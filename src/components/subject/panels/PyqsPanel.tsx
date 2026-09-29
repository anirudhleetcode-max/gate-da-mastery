"use client";
import Link from "next/link";
import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { QuestionMeta } from "@/lib/content/types";
import { useQuestionStatuses } from "@/lib/userdata/hooks";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { PyqRow } from "@/components/pyq/PyqRow";
import { isAttempted, pyqState } from "@/components/pyq/status";
import { useStoreNavList } from "@/components/pyq/useNavList";
import { pyqTitle, slotName } from "@/components/pyq/data";
import { SUBJECT_SHORT } from "@/lib/labels";
import { formatDate, formatMarks, plural } from "@/lib/utils";
import type { PanelProps } from "./common";

interface YearGroup {
  year: number;
  sessions: { paperId: string; session: number; examDate?: string; slot?: string; rows: QuestionMeta[] }[];
}

/** Questions are already newest paper first, then by question number. */
function groupByYearSession(rows: QuestionMeta[], papers: PanelProps["data"]["papers"]): YearGroup[] {
  const out: YearGroup[] = [];
  for (const q of rows) {
    const year = q.year ?? 0;
    let y = out.find((g) => g.year === year);
    if (!y) out.push((y = { year, sessions: [] }));
    const paperId = q.paperId ?? `unknown-${year}`;
    let s = y.sessions.find((x) => x.paperId === paperId);
    if (!s) {
      const p = papers.find((x) => x.id === paperId);
      y.sessions.push((s = { paperId, session: q.session ?? p?.session ?? 0, examDate: q.examDate ?? p?.examDate, slot: q.slot ?? p?.slot, rows: [] }));
    }
    s.rows.push(q);
  }
  out.sort((a, b) => b.year - a.year);
  for (const y of out) y.sessions.sort((a, b) => b.session - a.session);
  return out;
}

export function PyqsPanel({ data }: PanelProps) {
  const s = data.subject;
  const statuses = useQuestionStatuses();
  const storeNavList = useStoreNavList();
  const groups = useMemo(() => groupByYearSession(data.pyqs, data.papers), [data.pyqs, data.papers]);
  const ids = useMemo(() => groups.flatMap((y) => y.sessions.flatMap((x) => x.rows.map((q) => q.id))), [groups]);
  const topicName = useMemo(() => new Map(data.topics.map((t) => [t.id, t.name])), [data.topics]);
  const attempted = ids.filter((id) => isAttempted(pyqState(statuses.get(id)))).length;
  const browseHref = `/pyqs/browse?subject=${s.id}`;

  if (!data.pyqs.length)
    return (
      <EmptyState title={`No official ${s.name} questions are in the question bank yet`} action={<ButtonLink href="/pyqs">All PYQs</ButtonLink>}>
        Official questions appear here, grouped by year and session, as they are added to the question bank.
      </EmptyState>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-2" role="status">
          {attempted ? (
            <>
              You have attempted <span className="tnum font-semibold text-fg">{attempted}</span> of the <span className="tnum">{ids.length}</span> official {s.name} questions.
            </>
          ) : (
            <>
              {plural(ids.length, "official question")}, newest paper first. Previous / Next on each question follow this list.
            </>
          )}
        </p>
        <ButtonLink href={browseHref} size="sm">
          <SlidersHorizontal aria-hidden className="h-4 w-4" /> Filter these PYQs
        </ButtonLink>
      </div>

      {groups.map((y) => (
        <section key={y.year} aria-labelledby={`pyq-y-${y.year}`} className="space-y-3">
          <h3 id={`pyq-y-${y.year}`} className="text-base font-semibold text-fg">
            GATE {y.year || "(year unknown)"}
          </h3>
          {y.sessions.map((sess) => {
            const marks = sess.rows.reduce((a, q) => a + q.marks, 0);
            return (
              <div key={sess.paperId}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h4 className="text-sm font-medium text-fg-2">
                    Session {sess.session}
                    {sess.examDate ? ` · ${formatDate(sess.examDate)}` : ""}
                    {sess.slot ? ` · ${slotName(sess.slot)}` : ""}
                  </h4>
                  <p className="tnum text-xs text-fg-3">
                    {plural(sess.rows.length, "question")} · {formatMarks(marks)} marks
                    {sess.paperId.startsWith("DA-") ? (
                      <>
                        {" · "}
                        <Link href={`/pyqs/papers/${sess.paperId}`} className="font-medium text-accent-text hover:underline">
                          Full paper
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
                  {sess.rows.map((q, i) => (
                    <li key={q.id}>
                      <PyqRow
                        meta={q}
                        topicName={topicName.get(q.topicId) ?? q.topicId}
                        subjectLabel={SUBJECT_SHORT[q.subjectId]}
                        state={pyqState(statuses.get(q.id))}
                        onNavigate={() => storeNavList(ids)}
                        className={i === sess.rows.length - 1 ? "border-b-0" : undefined}
                        trailing={<BookmarkButton kind="question" refId={q.id} title={pyqTitle(q)} label={pyqTitle(q)} subjectId={q.subjectId} compact className="h-10 w-10 justify-center px-0" />}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      ))}

      <p className="text-sm text-fg-3">
        Need a narrower list? <Link href={browseHref} className="font-medium text-accent-text hover:underline">Filter {s.name} PYQs</Link> by topic, year, difficulty, type, marks or your status.
      </p>
    </div>
  );
}
