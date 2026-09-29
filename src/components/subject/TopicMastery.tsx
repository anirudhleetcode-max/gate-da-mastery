"use client";
import type { Catalog } from "@/lib/server/repo";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { MASTERY_HALF_LIFE_DAYS, MASTERY_MIN_ATTEMPTS } from "@/lib/analytics/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { pct, plural } from "@/lib/utils";
import { AccuracyValue, MasteryBadge, MasteryMethod } from "./bits";
import { useDataStatus } from "./hooks";
import { DataStatusNote } from "./panels/common";
import type { ReactNode } from "react";

function Component({ label, weight, value, detail, fallback }: { label: string; weight: number; value: number | null; detail?: string; fallback: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-fg-2">
          {label} <span className="tnum text-xs text-fg-3">· {weight > 0 ? `${Math.round(weight * 100)}% weight` : "no weight"}</span>
        </span>
        <span className="tnum font-semibold text-fg">{value === null ? "—" : pct(value, 0)}</span>
      </div>
      {value === null ? (
        <p className="mt-0.5 text-xs text-fg-3">{fallback}</p>
      ) : (
        <>
          <ProgressBar value={value} max={1} label={`${label}: ${pct(value, 0)}`} className="mt-1" />
          {detail ? <p className="mt-0.5 text-xs text-fg-3">{detail}</p> : null}
        </>
      )}
    </li>
  );
}

/** "Your topic mastery" with its component breakdown and the documented formula. */
export function TopicMastery({ catalog, topicId }: { catalog: Catalog; topicId: string }) {
  const model = useProgressModel(catalog);
  const status = useDataStatus();
  const tp = model.topics.find((t) => t.topicId === topicId);

  let body: ReactNode;
  if (status !== "ready" || !tp) body = <DataStatusNote status={status === "ready" ? "loading" : status} />;
  else {
    const m = tp.mastery;
    const c = m.components;
    const wAcc = 0.6 + (c.pyqCoverage === null ? 0.25 : 0) + (c.revisionHealth === null ? 0.15 : 0);
    const need = Math.max(0, MASTERY_MIN_ATTEMPTS - m.evidence);
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          {m.score !== null ? (
            <p className="tnum text-3xl font-semibold tracking-tight text-fg">
              {m.score}
              <span className="text-base font-normal text-fg-3"> / 100</span>
            </p>
          ) : (
            <p className="text-lg font-semibold text-fg">Not enough data</p>
          )}
          {m.score !== null ? <MasteryBadge mastery={m} /> : null}
        </div>
        <p className="text-sm text-fg-2">
          {m.score !== null
            ? `Based on ${plural(m.evidence, "answered question")} in this topic.`
            : m.evidence
              ? `Answer ${need} more ${need === 1 ? "question" : "questions"} in this topic to see a score (${m.evidence} so far).`
              : `Answer at least ${MASTERY_MIN_ATTEMPTS} questions in this topic to see a score.`}
        </p>
        <ul className="space-y-3">
          <Component label="Recent accuracy" weight={wAcc} value={c.recentAccuracy} fallback="No answers yet." detail={`Each answer weighted by recency (${MASTERY_HALF_LIFE_DAYS}-day half-life).`} />
          <Component
            label="PYQ coverage"
            weight={c.pyqCoverage === null ? 0 : 0.25}
            value={c.pyqCoverage}
            fallback="This topic has no official PYQs, so this weight moves to accuracy."
            detail={`${tp.pyqDone} of ${plural(tp.pyqTotal, "PYQ")} attempted.`}
          />
          <Component
            label="Revision health"
            weight={c.revisionHealth === null ? 0 : 0.15}
            value={c.revisionHealth}
            fallback="No revision items in this topic, so this weight moves to accuracy."
            detail={`${plural(tp.revisionItems, "revision item")}, ${tp.revisionDue} due now.`}
          />
        </ul>
        <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
          <span className="text-fg-3">Your accuracy</span>
          <span className="font-semibold text-fg">
            <AccuracyValue correct={tp.correct} attempted={tp.attempted} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Your topic mastery" description="From your answers on this device. Not an official GATE metric." />
      <CardBody className="space-y-4">
        {body}
        <details className="group rounded-lg border border-border bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-fg marker:text-fg-3">How is this calculated?</summary>
          <MasteryMethod className="mt-2" />
        </details>
      </CardBody>
    </Card>
  );
}
