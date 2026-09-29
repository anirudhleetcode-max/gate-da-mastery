"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Hourglass, Lock } from "lucide-react";
import { useMockAttempts, useQuestionStatuses } from "@/lib/userdata/hooks";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PyqRow } from "@/components/pyq/PyqRow";
import { pyqState } from "@/components/pyq/status";
import { useStoreNavList } from "@/components/pyq/useNavList";
import { SUBJECT_SHORT } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { DifficultyNote } from "../bits";
import { DataStatusNote, type PanelProps } from "./common";

/** Rows rendered before "Show more mocks" (whole mocks are shown). */
const ROW_BUDGET = 100;

export function MockQuestionsPanel({ data, status }: PanelProps) {
  const s = data.subject;
  const attempts = useMockAttempts();
  const statuses = useQuestionStatuses();
  const storeNavList = useStoreNavList();
  const [budget, setBudget] = useState(ROW_BUDGET);
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
  const { unlocked, notTaken, inReview, ids } = useMemo(() => {
    const open = byMock.filter((g) => submitted.has(g.mock.id));
    const rest = byMock.filter((g) => !submitted.has(g.mock.id));
    return {
      unlocked: open,
      notTaken: rest.filter((g) => g.mock.available),
      inReview: rest.filter((g) => !g.mock.available),
      ids: open.flatMap((g) => g.rows.map((q) => q.id)),
    };
  }, [byMock, submitted]);
  const visible = useMemo(() => {
    const out: typeof unlocked = [];
    let rows = 0;
    for (const g of unlocked) {
      if (out.length && rows >= budget) break;
      out.push(g);
      rows += g.rows.length;
    }
    return out;
  }, [unlocked, budget]);
  const hiddenRows = unlocked.slice(visible.length).reduce((a, g) => a + g.rows.length, 0);

  if (!data.mockQuestions.length)
    return (
      <EmptyState title={`No mock-test questions cover ${s.name} yet`} action={<ButtonLink href="/mocks">Mock tests</ButtonLink>}>
        When mock tests with {s.name} questions are released, their questions appear here after you take and submit each mock.
      </EmptyState>
    );

  if (status !== "ready") return <DataStatusNote status={status} />;

  const availableQuestions = notTaken.reduce((a, g) => a + g.rows.length, 0);

  return (
    <div className="space-y-6">
      {unlocked.length ? (
        <>
          <div className="space-y-1">
            <p className="text-sm text-fg-2" role="status">
              {plural(ids.length, "question")} from {plural(unlocked.length, "mock")} you have submitted. These are original questions written for this platform, not official GATE questions.
            </p>
            <DifficultyNote />
          </div>
          {visible.map(({ mock, rows }) => (
            <section key={mock.id} aria-labelledby={`mock-${mock.id}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 id={`mock-${mock.id}`} className="text-base font-semibold text-fg">
                  {mock.title}
                </h3>
                <Link href={`/mocks/${mock.id}`} className="inline-flex min-h-8 items-center text-sm font-medium text-accent-text hover:underline">
                  Mock details &amp; results<span className="sr-only">: {mock.title}</span>
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
          {hiddenRows ? (
            <Button onClick={() => setBudget((b) => b + ROW_BUDGET)} className="w-full sm:w-auto">
              Show more mocks ({plural(hiddenRows, "question")} in {plural(unlocked.length - visible.length, "mock")})
            </Button>
          ) : null}
        </>
      ) : notTaken.length ? (
        <EmptyState title="Mock questions unlock after you take the mock" action={<ButtonLink href="/mocks" variant="primary">Choose a mock test</ButtonLink>}>
          {plural(availableQuestions, "question")} in {plural(notTaken.length, "available mock test")} cover {s.name}. To keep each mock unseen until you sit it, its questions appear here only after you
          submit that mock.
        </EmptyState>
      ) : (
        <EmptyState title={`No mock test with ${s.name} questions is available to take yet`} action={<ButtonLink href="/mocks">Mock tests</ButtonLink>}>
          {plural(inReview.length, "mock test")} with {s.name} questions {inReview.length === 1 ? "is" : "are"} still in review. A mock opens once every one of its questions is verified; after you take and submit
          it, its {s.name} questions appear here.
        </EmptyState>
      )}

      {notTaken.length ? (
        <section aria-labelledby="mock-locked-h">
          <h3 id="mock-locked-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg-2">
            <Lock aria-hidden className="h-4 w-4" /> Not taken yet
          </h3>
          <MockLinks groups={notTaken} />
        </section>
      ) : null}

      {inReview.length ? (
        <section aria-labelledby="mock-review-h">
          <h3 id="mock-review-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg-2">
            <Hourglass aria-hidden className="h-4 w-4" /> Still in review (not available yet)
          </h3>
          <MockLinks groups={inReview} />
        </section>
      ) : null}
    </div>
  );
}

function MockLinks({ groups }: { groups: { mock: PanelProps["data"]["mocks"][number]; rows: unknown[] }[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {groups.map(({ mock, rows }) => (
        <li key={mock.id}>
          <Link href={`/mocks/${mock.id}`} className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2">
            <span className="min-w-0 text-fg">{mock.title}</span>
            <span className="tnum shrink-0 text-xs text-fg-3">
              {rows.length} {rows.length === 1 ? "question" : "questions"}
              <span className="sr-only"> on this subject</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
