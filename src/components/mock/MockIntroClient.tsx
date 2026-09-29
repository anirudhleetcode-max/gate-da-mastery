"use client";
import Link from "next/link";
import { useState } from "react";
import { Lock, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import { useMockAttempts, useUserData } from "@/lib/userdata/hooks";
import { discardInProgress } from "@/lib/mock/persist";
import { formatDateTime, formatMinutes } from "@/lib/mock/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatClock, formatDuration, formatMarks, pct } from "@/lib/utils";

/** Start / Resume panel for a mock's intro page. */
export function MockStartPanel({ testId, number, available, durationMinutes }: { testId: string; number: number; available: boolean; durationMinutes: number }) {
  const { db, ready, available: storageOk } = useUserData();
  const attempts = useMockAttempts(testId);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = attempts.find((a) => a.status === "in_progress");
  const taken = attempts.filter((a) => a.status === "submitted").length;
  const examHref = `/mocks/${testId}/exam`;

  if (!available) {
    return (
      <Card>
        <CardBody>
          <p className="flex items-center gap-2 font-semibold text-fg">
            <Lock aria-hidden className="h-4 w-4 text-fg-3" /> Not yet available
          </p>
          <p className="mt-1 text-sm text-fg-2">This mock opens once its full paper is published. Meanwhile, take one of the available mocks.</p>
          <ButtonLink href="/mocks" className="mt-4 w-full">
            Choose another mock
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        {ready && !storageOk ? (
          <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-fg">
            This browser window blocks local storage, which mock attempts need for saving and results. Open the site in a normal window.
          </p>
        ) : null}
        {inProgress ? (
          <>
            <p className="text-sm text-fg-2">
              You have an attempt in progress with <span className="tnum font-semibold text-fg">{formatClock(inProgress.remainingMs)}</span> remaining (started {formatDateTime(inProgress.startedAt)}).
            </p>
            <ButtonLink href={examHref} variant="primary" size="lg" className="w-full text-surface">
              <PlayCircle aria-hidden className="h-5 w-5" /> Resume Mock {number}
            </ButtonLink>
            <Button variant="ghost" className="w-full text-danger hover:text-danger" onClick={() => setConfirm(true)} disabled={!db}>
              <Trash2 aria-hidden className="h-4 w-4" /> Discard and start over
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-fg-2">
              The {formatMinutes(durationMinutes)} timer starts as soon as the exam screen opens. If you close the page, your answers are saved and the timer pauses until you resume.
              {taken ? ` You have taken this mock ${taken === 1 ? "once" : `${taken} times`}; a retake is scored as a new attempt.` : ""}
            </p>
            {ready && !storageOk ? (
              <Button variant="primary" size="lg" className="w-full text-surface" disabled>
                {taken ? `Retake Mock ${number}` : `Start Mock ${number}`}
              </Button>
            ) : (
              <ButtonLink href={examHref} variant="primary" size="lg" className="w-full text-surface">
                {taken ? <RotateCcw aria-hidden className="h-5 w-5" /> : <PlayCircle aria-hidden className="h-5 w-5" />}
                {taken ? `Retake Mock ${number}` : `Start Mock ${number}`}
              </ButtonLink>
            )}
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardBody>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Discard the attempt in progress?"
        description="Its answers and remaining time are deleted from this device. Nothing from it is recorded in your analytics. This cannot be undone."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setConfirm(false)}>Keep it</Button>
          <Button
            variant="danger"
            className="text-surface"
            onClick={async () => {
              if (!db || !inProgress) return;
              try {
                await discardInProgress(db, inProgress.id);
                setConfirm(false);
                setError(null);
              } catch {
                setError("The attempt could not be discarded. Try again.");
              }
            }}
          >
            Discard attempt
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}

/** Previous attempts of one mock (newest first), linking to their results. */
export function AttemptHistory({ testId }: { testId: string }) {
  const { ready } = useUserData();
  const attempts = useMockAttempts(testId);
  const rows = [...attempts].sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt));
  return (
    <Card>
      <CardHeader title="Your attempts" description="Stored on this device. Scores are platform marks under the GATE marking scheme." />
      <CardBody className="p-0 sm:p-0">
        {!ready ? (
          <p className="px-4 py-4 text-sm text-fg-3 sm:px-5">Loading your attempts…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No attempts yet" className="m-4 border-0 bg-transparent px-2 py-4">
            Your score, accuracy and time appear here after you submit this mock.
          </EmptyState>
        ) : (
          <>
            {/* Phones: one stacked row per attempt (a 5-column table would scroll sideways). */}
            <ul className="divide-y divide-border sm:hidden" aria-label="Previous attempts of this mock">
              {rows.map((a) => {
                const href = a.status === "in_progress" ? `/mocks/${testId}/exam` : `/mocks/${testId}/results/${a.id}`;
                return (
                  <li key={a.id}>
                    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="block text-sm text-fg-2">{formatDateTime(a.submittedAt ?? a.startedAt)}</span>
                        <span className="tnum block text-xs text-fg-3">
                          {a.status === "in_progress"
                            ? `In progress · ${formatClock(a.remainingMs)} left`
                            : a.result
                              ? `${pct(a.result.accuracy, 0)} accuracy · ${formatDuration(a.result.timeUsedMs)}`
                              : "Submitted · scoring pending"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm">
                        {a.result ? (
                          <span className="tnum font-semibold text-fg">
                            {formatMarks(a.result.score)} / {formatMarks(a.result.maxScore)}
                          </span>
                        ) : null}
                        <span className="font-medium text-accent-text">{a.status === "in_progress" ? "Resume" : "Results"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Previous attempts of this mock</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-fg-3">
                    <th scope="col" className="px-4 py-2 font-medium sm:px-5">
                      Date
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Score
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Accuracy
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium sm:px-5">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-fg-2 sm:px-5">{formatDateTime(a.submittedAt ?? a.startedAt)}</td>
                      {a.status === "in_progress" ? (
                        <td colSpan={3} className="px-2 py-2.5 text-right text-fg-2">
                          In progress · <span className="tnum">{formatClock(a.remainingMs)}</span> left
                        </td>
                      ) : a.result ? (
                        <>
                          <td className="tnum whitespace-nowrap px-2 py-2.5 text-right font-medium text-fg">
                            {formatMarks(a.result.score)} / {formatMarks(a.result.maxScore)}
                          </td>
                          <td className="tnum px-2 py-2.5 text-right text-fg-2">{pct(a.result.accuracy, 0)}</td>
                          <td className="tnum whitespace-nowrap px-2 py-2.5 text-right text-fg-2">{formatDuration(a.result.timeUsedMs)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-2 py-2.5 text-right text-fg-2">
                          Submitted · scoring pending
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-2.5 text-right sm:px-5">
                        {a.status === "in_progress" ? (
                          <Link href={`/mocks/${testId}/exam`} className="font-medium text-accent-text hover:underline">
                            Resume
                          </Link>
                        ) : (
                          <Link href={`/mocks/${testId}/results/${a.id}`} className="font-medium text-accent-text hover:underline">
                            Results
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
