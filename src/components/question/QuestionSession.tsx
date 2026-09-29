"use client";
/**
 * Runs a sequence of questions (Practice Now, Today's set, revision re-attempts).
 * Fetches payloads in batches from /api/questions/batch, shows one question at
 * a time with the full QuestionView, optional countdown, and a summary.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Timer } from "lucide-react";
import type { QuestionPayload } from "@/lib/server/payload";
import type { AttemptContext } from "@/lib/userdata/db";
import { QuestionView } from "./QuestionView";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Progress";
import { Stat } from "@/components/ui/Stat";
import { formatClock, formatMarks, pct } from "@/lib/utils";

export interface SessionResult {
  id: string;
  status: string;
  marks: number;
}

export function QuestionSession({
  ids,
  context,
  timeLimitSec,
  title,
  onFinish,
}: {
  ids: string[];
  context: AttemptContext;
  /** Total time limit for the whole session (seconds); omit for untimed. */
  timeLimitSec?: number;
  title?: string;
  onFinish?: (results: SessionResult[]) => void;
}) {
  const [payloads, setPayloads] = useState<Record<string, QuestionPayload>>({});
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, SessionResult>>({});
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());

  // Fetch in batches of 20, current question first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (let i = 0; i < ids.length; i += 20) {
          const chunk = ids.slice(i, i + 20);
          const res = await fetch(`/api/questions/batch?ids=${encodeURIComponent(chunk.join(","))}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as QuestionPayload[];
          if (cancelled) return;
          setPayloads((p) => ({ ...p, ...Object.fromEntries(data.map((q) => [q.id, q])) }));
        }
      } catch (e) {
        if (!cancelled) setError(`Could not load questions (${(e as Error).message}). Check your connection and try again.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  useEffect(() => {
    if (!timeLimitSec || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timeLimitSec, finished]);

  const remainingMs = timeLimitSec ? Math.max(0, timeLimitSec * 1000 - (now - startedAt)) : null;
  const timeUp = remainingMs !== null && remainingMs <= 0;
  const done = finished || timeUp;

  const summary = useMemo(() => {
    const rs = Object.values(results);
    const correct = rs.filter((r) => r.status === "correct").length;
    const incorrect = rs.filter((r) => r.status === "incorrect").length;
    return { answered: rs.length, correct, incorrect, marks: rs.reduce((a, r) => a + r.marks, 0), accuracy: correct + incorrect ? correct / (correct + incorrect) : null };
  }, [results]);

  const finishedOnce = useRef(false);
  useEffect(() => {
    if (done && !finishedOnce.current) {
      finishedOnce.current = true;
      onFinish?.(Object.values(results));
    }
  }, [done, results, onFinish]);

  if (!ids.length) return null;
  if (error) return <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>;

  if (done) {
    return (
      <section aria-labelledby="session-summary" className="space-y-4">
        <h2 id="session-summary" className="text-xl font-semibold">
          {timeUp && !finished ? "Time is up" : "Session complete"}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Answered" value={`${summary.answered}/${ids.length}`} />
          <Stat label="Correct" value={summary.correct} />
          <Stat label="Accuracy" value={pct(summary.accuracy)} />
          <Stat label="Marks (GATE scheme)" value={formatMarks(summary.marks)} />
        </div>
        <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
          {ids.map((id, i) => {
            const r = results[id];
            const q = payloads[id];
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="tnum w-8 text-fg-3">{i + 1}.</span>
                <Link href={`/questions/${id}`} className="min-w-0 flex-1 truncate text-fg hover:underline">
                  {q ? q.preview : id}
                </Link>
                <span className={r?.status === "correct" ? "text-success" : r?.status === "incorrect" ? "text-danger" : "text-fg-3"}>
                  {r ? (r.status === "not_scored" ? "Not scored" : r.status === "correct" ? "Correct" : "Incorrect") : "Not answered"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const id = ids[index];
  const q = payloads[id];
  return (
    <section aria-label={title ?? "Question session"} className="space-y-5">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="tnum text-sm font-medium text-fg">
          Question {index + 1} of {ids.length}
        </span>
        <ProgressBar className="min-w-24 flex-1" value={Object.keys(results).length} max={ids.length} label="Questions answered" />
        {remainingMs !== null ? (
          <span className="tnum inline-flex items-center gap-1 text-sm font-medium text-fg" aria-live="off">
            <Timer aria-hidden className="h-4 w-4" /> {formatClock(remainingMs)}
          </span>
        ) : null}
        <Button size="sm" onClick={() => setFinished(true)}>
          Finish
        </Button>
      </div>
      {q ? (
        <QuestionView
          q={q}
          context={context}
          headingLevel="h2"
          onSubmitted={(r) => setResults((prev) => ({ ...prev, [id]: { id, ...r } }))}
        />
      ) : (
        <p className="text-sm text-fg-3" role="status">
          Loading question…
        </p>
      )}
      <nav aria-label="Session navigation" className="flex items-center justify-between border-t border-border pt-4">
        <Button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
        </Button>
        {index < ids.length - 1 ? (
          <Button variant="primary" onClick={() => setIndex((i) => i + 1)}>
            Next <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setFinished(true)}>
            Finish session
          </Button>
        )}
      </nav>
    </section>
  );
}
