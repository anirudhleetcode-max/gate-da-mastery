"use client";
/**
 * Results of one mock attempt. Loads the attempt from IndexedDB and the answer
 * key from /api/mocks/[id]/key (only for a submitted attempt), finishes
 * scoring if the exam page could not (e.g. it was offline), then shows the
 * score, subject and topic analysis, strategy diagnostics, time analysis and a
 * filterable question review with full solutions.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import type { MockAttemptRow } from "@/lib/userdata/db";
import { useAttempts, useDbQuery, useErrorLogs, useUserData } from "@/lib/userdata/hooks";
import { finalizeAttempt } from "@/lib/mock/persist";
import { avgTimePerAttempted, computeDiagnostics, historicalWeakTopics, scoreAttempt, weakTopicsInMock, type ReviewFilter } from "@/lib/mock/analysis";
import { timeUsedMs } from "@/lib/mock/session";
import { formatDateTime, formatMinutes } from "@/lib/mock/format";
import type { KeyResponse } from "@/lib/mock/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { formatClock, formatDuration, formatMarks, pct } from "@/lib/utils";
import { MockLabel } from "./MockLabel";
import { QuestionReview, StrategyPanel, SubjectPerformance, TimeAnalysis, WeakTopicsPanel } from "./ResultsSections";

export interface ResultsTestMeta {
  id: string;
  number: number;
  title: string;
  durationMinutes: number;
}

export function ResultsView({ test, attemptId }: { test: ResultsTestMeta; attemptId: string }) {
  const { db, ready, available } = useUserData();
  const attempt = useDbQuery<MockAttemptRow | null | undefined>(async (d) => (await d.mockAttempts.get(attemptId)) ?? null, [attemptId], undefined);
  const history = useAttempts();
  const errorLogs = useErrorLogs();

  const submitted = attempt?.status === "submitted" && attempt.testId === test.id;
  const [key, setKey] = useState<KeyResponse | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyRequest, setKeyRequest] = useState(0);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // The answer key is fetched only for a submitted attempt (no spoilers for one in progress).
  useEffect(() => {
    if (!submitted) return;
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/mocks/${encodeURIComponent(test.id)}/key`, { signal: ctrl.signal });
        if (!res.ok)
          throw new Error(
            res.status === 404
              ? "The answer key for this mock was not found on the server."
              : res.status === 403
                ? "This mock has been withdrawn for re-verification, so its answer key is not shown right now. Your saved responses are kept."
                : `The server answered with status ${res.status}.`,
          );
        const data = (await res.json()) as KeyResponse;
        if (!cancelled) {
          setKey(data);
          setKeyError(null);
        }
      } catch (e) {
        if (!cancelled) setKeyError(e instanceof TypeError ? "The answer key could not be downloaded. Check your connection." : (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [submitted, test.id, keyRequest]);

  // Finish scoring when the exam page could not (idempotent).
  const needsScoring = Boolean(submitted && attempt && !attempt.result && key);
  useEffect(() => {
    if (!needsScoring || !db || !key) return;
    let cancelled = false;
    finalizeAttempt(db, attemptId, key).catch((e: Error) => {
      if (!cancelled) setFinalizeError(e.message || "Scoring failed.");
    });
    return () => {
      cancelled = true;
    };
  }, [needsScoring, db, key, attemptId]);

  // Question review: one question expanded at a time; diagnostics can open one.
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const toggleQuestion = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), []);
  const openInReview = useCallback((id: string) => {
    setReviewFilter("all");
    setOpenId(id);
    requestAnimationFrame(() => {
      document.getElementById(`review-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      document.getElementById(`review-btn-${id}`)?.focus({ preventScroll: true });
    });
  }, []);

  const retryKey = useCallback(() => {
    setKeyError(null);
    setKeyRequest((n) => n + 1);
  }, []);

  const analysis = useMemo(() => {
    if (!key || !attempt || !submitted) return null;
    const byId = new Map(key.questions.map((q) => [q.id, q]));
    const questions = key.test.questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q) && q!.id in attempt.questions);
    const scored = scoreAttempt(questions, attempt, key.test.negativeMarking);
    const topicIds = new Set(scored.items.map((i) => i.topicId));
    return {
      questions,
      ...scored,
      avgTime: avgTimePerAttempted(scored.items),
      weakHere: weakTopicsInMock(scored.items),
      weakHistory: historicalWeakTopics(topicIds, history),
      diagnostics: computeDiagnostics(scored.items, history, { attemptId: attempt.id, before: attempt.startedAt }),
    };
  }, [key, attempt, submitted, history]);

  // Wrong answers of this attempt that are in the error log (added automatically when that setting is on).
  const loggedWrong = useMemo(() => {
    if (!analysis) return 0;
    const logged = new Set(errorLogs.map((e) => e.questionId));
    return analysis.items.filter((i) => i.status === "incorrect" && logged.has(i.id)).length;
  }, [analysis, errorLogs]);

  const crumbs = [
    { label: "Mock tests", href: "/mocks" },
    { label: `Mock ${test.number}`, href: `/mocks/${test.id}` },
    { label: "Results" },
  ];
  const actions = (
    <>
      <ButtonLink href={`/mocks/${test.id}`} variant="primary" className="text-surface">
        <RotateCcw aria-hidden className="h-4 w-4" /> Retake mock
      </ButtonLink>
      <ButtonLink href="/mocks">Back to mocks</ButtonLink>
    </>
  );

  // ------------------------------------------------------------ non-result states
  if (ready && !available) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={`Mock ${test.number} results`} />
        <EmptyState title="Your browser is blocking local storage" action={<ButtonLink href="/mocks">Back to mocks</ButtonLink>}>
          Mock attempts and their results are stored on this device, and this browser window does not allow access to that storage.
        </EmptyState>
      </>
    );
  }
  if (!ready || attempt === undefined) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={`Mock ${test.number} results`} />
        <p role="status" className="flex items-center gap-2 text-sm text-fg-3">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Loading your attempt…
        </p>
      </>
    );
  }
  if (attempt === null || attempt.testId !== test.id) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={`Mock ${test.number} results`} />
        <EmptyState title="This attempt is not on this device" action={<ButtonLink href={`/mocks/${test.id}`} variant="primary" className="text-surface">Go to Mock {test.number}</ButtonLink>}>
          Results are stored in this browser only. The attempt may have been taken in another browser or device, or the local data was cleared or replaced by a backup import.
        </EmptyState>
      </>
    );
  }
  if (attempt.status === "in_progress") {
    return (
      <>
        <PageHeader crumbs={crumbs} title={`Mock ${test.number} results`} />
        <EmptyState title="This attempt has not been submitted yet" action={<ButtonLink href={`/mocks/${test.id}/exam`} variant="primary" className="text-surface">Resume Mock {test.number}</ButtonLink>}>
          {formatClock(attempt.remainingMs)} remain on the timer. Results and solutions appear after you submit.
        </EmptyState>
      </>
    );
  }

  const res = analysis?.score;
  const stored = attempt.result;
  const keyChanged = Boolean(res && stored && (Math.abs(res.score - stored.score) > 0.005 || res.maxScore !== stored.maxScore));
  const used = stored?.timeUsedMs ?? timeUsedMs(attempt);

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={`Mock ${test.number} results`}
        description={
          <>
            {test.title.replace(/^Mock\s+\d+\s*:\s*/i, "")} · submitted {formatDateTime(attempt.submittedAt)} · {formatDuration(used)} of {formatMinutes(test.durationMinutes)} used
          </>
        }
        actions={actions}
      />
      <MockLabel className="mb-6" />

      {keyError ? (
        <Callout tone="warning" className="mb-6" title="The detailed analysis needs the answer key">
          <span className="block">{keyError}</span>
          <Button size="sm" className="mt-2" onClick={retryKey}>
            Try again
          </Button>
        </Callout>
      ) : null}
      {finalizeError ? (
        <Callout tone="danger" className="mb-6" title="This attempt could not be scored">
          {finalizeError} Reload the page to try again.
        </Callout>
      ) : null}
      {!stored && !keyError && !finalizeError ? (
        <p role="status" className="mb-6 flex items-center gap-2 text-sm text-fg-3">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Scoring your attempt…
        </p>
      ) : null}
      {keyChanged ? (
        <Callout tone="info" className="mb-6" title="The answer key was updated after this attempt was scored">
          The analysis below uses the current key. Your score when submitted was {formatMarks(stored!.score)} / {formatMarks(stored!.maxScore)}.
        </Callout>
      ) : null}

      {/* ------------------------------------------------ score */}
      <section aria-labelledby="score-h" className="mb-8">
        <h2 id="score-h" className="sr-only">
          Score
        </h2>
        {res || stored ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Score" value={`${formatMarks(res?.score ?? stored!.score)} / ${formatMarks(res?.maxScore ?? stored!.maxScore)}`} hint="GATE marking scheme" />
              <Stat label="Accuracy" value={pct(res?.accuracy ?? stored!.accuracy, 0)} hint="Correct ÷ attempted" />
              <Stat label="Attempted" value={`${res?.attempted ?? stored!.attempted} / ${analysis?.items.length ?? (stored!.attempted + stored!.unanswered)}`} />
              <Stat label="Time used" value={formatDuration(used)} hint={`of ${formatMinutes(test.durationMinutes)}`} />
              <Stat label="Correct" value={<span className="text-success">{res?.correct ?? stored!.correct}</span>} />
              <Stat label="Incorrect" value={<span className="text-danger">{res?.incorrect ?? stored!.incorrect}</span>} />
              <Stat label="Skipped" value={res?.unanswered ?? stored!.unanswered} />
              <Stat label="Average time" value={analysis ? formatDuration(analysis.avgTime) : "—"} hint="per attempted Q" />
            </div>
            {res ? (
              <p className="mt-3 text-sm text-fg-2">
                Marks gained <span className="tnum font-semibold text-success">+{formatMarks(res.positiveMarks)}</span>
                {" · "}lost to negative marking <span className="tnum font-semibold text-danger">{res.negativeMarks < 0 ? `−${formatMarks(-res.negativeMarks)}` : "0"}</span>
                {" · "}net <span className="tnum font-semibold text-fg">{formatMarks(res.score)}</span>. These are platform marks under the GATE marking scheme, not a GATE score, and they do not predict a rank.
              </p>
            ) : null}
            {stored && (res?.incorrect ?? stored.incorrect) > 0 ? (
              <p className="mt-2 text-sm text-fg-3">
                {res?.incorrect ?? stored.incorrect} wrong {(res?.incorrect ?? stored.incorrect) === 1 ? "answer was" : "answers were"} added to your{" "}
                <Link href="/revision" className="underline">
                  revision queue
                </Link>
                {loggedWrong ? (
                  <>
                    {" "}and{" "}
                    <Link href="/errors" className="underline">
                      error log
                    </Link>
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-fg-3">Your score appears once the attempt is scored.</p>
        )}
      </section>

      {analysis ? (
        <div className="space-y-10">
          <SubjectPerformance bySubject={analysis.bySubject} />
          <WeakTopicsPanel here={analysis.weakHere} history={analysis.weakHistory} items={analysis.items} />
          <StrategyPanel d={analysis.diagnostics} items={analysis.items} confidenceRecorded={analysis.items.some((i) => i.confidence)} negativeMarking={key!.test.negativeMarking} onOpen={openInReview} />
          <TimeAnalysis items={analysis.items} />
          <QuestionReview questions={analysis.questions} items={analysis.items} attempt={attempt} filter={reviewFilter} onFilter={setReviewFilter} openId={openId} onToggle={toggleQuestion} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-6">{actions}</div>
        </div>
      ) : null}
    </>
  );
}
