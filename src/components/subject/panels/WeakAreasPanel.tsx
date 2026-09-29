"use client";
import Link from "next/link";
import { useMemo } from "react";
import { wilsonLower } from "@/lib/analytics/stats";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import { pct, plural } from "@/lib/utils";
import { TabLink } from "../tabNav";
import { DataStatusNote, topicHref, type PanelProps } from "./common";

/** Same thresholds as weakTopics() in lib/analytics/stats.ts (its defaults). */
const WEAK_MIN_ATTEMPTS = 3;
const WEAK_THRESHOLD = 0.7;

export function WeakAreasPanel({ data, model, status }: PanelProps) {
  const s = data.subject;
  const rows = useMemo(() => {
    const progress = new Map(model.topics.map((t) => [t.topicId, t]));
    return data.topics.map((t) => {
      const p = progress.get(t.id);
      const attempted = p?.attempted ?? 0;
      const correct = p?.correct ?? 0;
      return { topic: t, attempted, correct, accuracy: attempted ? correct / attempted : null, lower: wilsonLower(correct, attempted) };
    });
  }, [data.topics, model.topics]);
  // Topics with enough answers to judge come first (weakest by Wilson lower bound); the rest follow, most answered first.
  const judged = (r: (typeof rows)[number]) => (r.attempted >= WEAK_MIN_ATTEMPTS ? 0 : 1);
  const answered = rows
    .filter((r) => r.attempted > 0)
    .sort((a, b) => judged(a) - judged(b) || (judged(a) ? b.attempted - a.attempted : a.lower - b.lower || (a.accuracy ?? 0) - (b.accuracy ?? 0)));
  const untouched = rows.filter((r) => r.attempted === 0);

  if (status !== "ready") return <DataStatusNote status={status} />;
  if (!answered.length)
    return (
      <EmptyState
        title={`You have not answered any ${s.name} questions yet`}
        action={
          <ButtonLink href={`/practice?subject=${s.id}&count=10`} variant="primary">
            Practice 10 questions
          </ButtonLink>
        }
      >
        Weak areas are worked out from your own answers. Answer a few questions in each topic (from the <TabLink tab="pyqs">PYQs</TabLink> or a practice set) and this list ranks the topics from weakest
        to strongest.
      </EmptyState>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-3">
        Topics you have answered, weakest first. Topics with {WEAK_MIN_ATTEMPTS} or more answers are ranked by the lower bound of the 95% Wilson interval for your accuracy, which is cautious with small
        samples: 2 correct out of 3 ranks below 7 out of 10 although both are close to 70%. A topic is marked weak when its accuracy is below {pct(WEAK_THRESHOLD, 0)}; topics with fewer answers are listed
        last.
      </p>
      <ol className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {answered.map((r, i) => {
          const verdict = r.attempted < WEAK_MIN_ATTEMPTS ? "few" : (r.accuracy ?? 0) < WEAK_THRESHOLD ? "weak" : "ok";
          return (
            <li key={r.topic.id} className="grid gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[1.5rem_minmax(0,1fr)_9rem_9rem] sm:items-center">
              <span className="tnum hidden text-sm text-fg-3 sm:block">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={topicHref(s.id, r.topic.id)} className="font-medium text-fg hover:underline">
                    {r.topic.name}
                  </Link>
                  {verdict === "weak" ? <Badge tone="danger">Weak</Badge> : verdict === "few" ? <Badge tone="neutral">Too few answers to judge</Badge> : <Badge tone="success">On track</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
                  <Link href={`/practice?subject=${s.id}&topic=${r.topic.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                    Practice<span className="sr-only"> {r.topic.name}</span>
                  </Link>
                  <Link href={topicHref(s.id, r.topic.id)} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                    Review topic<span className="sr-only"> {r.topic.name}</span>
                  </Link>
                </div>
              </div>
              <div className="text-sm">
                <div className="text-xs text-fg-3">Accuracy</div>
                <div className="tnum font-semibold text-fg">
                  {pct(r.accuracy, 0)}{" "}
                  <span className="text-xs font-normal text-fg-3">
                    ({r.correct}/{plural(r.attempted, "answer")})
                  </span>
                </div>
              </div>
              <div className="text-sm">
                <div className="text-xs text-fg-3">95% lower bound</div>
                <div className="flex items-center gap-2">
                  <span className="tnum w-10 font-semibold text-fg">{pct(r.lower, 0)}</span>
                  <ProgressBar value={r.lower} max={1} label={`${r.topic.name}: 95% lower bound of accuracy ${pct(r.lower, 0)}`} tone={verdict === "weak" ? "danger" : verdict === "ok" ? "success" : "accent"} className="flex-1" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {untouched.length ? (
        <section aria-labelledby="weak-untouched-h">
          <h3 id="weak-untouched-h" className="mb-1.5 text-sm font-semibold text-fg-2">
            Not answered yet ({untouched.length})
          </h3>
          <ul className="flex flex-wrap gap-2">
            {untouched.map((r) => (
              <li key={r.topic.id}>
                <Link href={topicHref(s.id, r.topic.id)} className="inline-flex min-h-8 items-center rounded-md border border-border bg-surface px-2.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg">
                  {r.topic.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
