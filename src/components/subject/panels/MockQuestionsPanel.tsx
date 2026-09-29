"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Lock } from "lucide-react";
import { useMockAttempts, useQuestionStatuses } from "@/lib/userdata/hooks";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PyqRow } from "@/components/pyq/PyqRow";
import { pyqState } from "@/components/pyq/status";
import { useStoreNavList } from "@/components/pyq/useNavList";
import { SUBJECT_SHORT } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { DataStatusNote, type PanelProps } from "./common";

export function MockQuestionsPanel({ data, status }: PanelProps) {
  const s = data.subject;
  const attempts = useMockAttempts();
  const statuses = useQuestionStatuses();
  const storeNavList = useStoreNavList();
  const submitted = useMemo(() => new Set(attempts.filter((a) => a.status === "submitted").map((a) => a.testId)), [attempts]);
  const topicName = useMemo(() => new Map(data.topics.map((t) => [t.id, t.name])), [data.topics]);

  const byMock = useMemo(
    () =>
      data.mocks
        .map((m) => ({ mock: m, rows: data.mockQuestions.filter((q) => q.testId === m.id) }))
        .filter((g) => g.rows.length)
        .sort((a, b) => a.mock.number - b.mock.number),
    [data.mocks, data.mockQuestions],
  );
  const { unlocked, locked, ids } = useMemo(() => {
    const open = byMock.filter((g) => submitted.has(g.mock.id));
    return { unlocked: open, locked: byMock.filter((g) => !submitted.has(g.mock.id)), ids: open.flatMap((g) => g.rows.map((q) => q.id)) };
  }, [byMock, submitted]);

  if (!data.mockQuestions.length)
    return (
      <EmptyState title={`No mock-test questions cover ${s.name} yet`} action={<ButtonLink href="/mocks">Mock tests</ButtonLink>}>
        When mock tests with {s.name} questions are available, the questions appear here after you take and submit each mock.
      </EmptyState>
    );

  if (status !== "ready") return <DataStatusNote status={status} />;

  return (
    <div className="space-y-6">
      {unlocked.length ? (
        <>
          <p className="text-sm text-fg-2" role="status">
            {plural(ids.length, "question")} from {plural(unlocked.length, "mock")} you have submitted. These are original questions written for this platform, not official GATE questions.
          </p>
          {unlocked.map(({ mock, rows }) => (
            <section key={mock.id} aria-labelledby={`mock-${mock.id}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 id={`mock-${mock.id}`} className="text-base font-semibold text-fg">
                  {mock.title}
                </h3>
                <Link href={`/mocks/${mock.id}`} className="text-sm font-medium text-accent-text hover:underline">
                  Mock details &amp; results
                </Link>
              </div>
              <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
                {rows.map((q, i) => (
                  <li key={q.id}>
                    <PyqRow
                      meta={q}
                      topicName={topicName.get(q.topicId) ?? q.topicId}
                      subjectLabel={SUBJECT_SHORT[q.subjectId]}
                      state={pyqState(statuses.get(q.id))}
                      onNavigate={() => storeNavList(ids)}
                      className={i === rows.length - 1 ? "border-b-0" : undefined}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      ) : (
        <EmptyState title="Mock questions unlock after you take the mock" action={<ButtonLink href="/mocks" variant="primary">Choose a mock test</ButtonLink>}>
          {plural(data.mockQuestions.length, "question")} across {plural(byMock.length, "mock test")} cover {s.name}. To keep each mock unseen until you sit it, its questions appear here only after you
          submit that mock.
        </EmptyState>
      )}

      {locked.length ? (
        <section aria-labelledby="mock-locked-h">
          <h3 id="mock-locked-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg-2">
            <Lock aria-hidden className="h-4 w-4" /> Not taken yet
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {locked.map(({ mock, rows }) => (
              <li key={mock.id}>
                <Link href={`/mocks/${mock.id}`} className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2">
                  <span className="min-w-0 text-fg">{mock.title}</span>
                  <span className="tnum shrink-0 text-xs text-fg-3">{plural(rows.length, "question")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
