"use client";
/**
 * Small building blocks shared by the dashboard, progress, today and practice
 * pages.
 */
import Link from "next/link";
import { ChartFrame } from "@/components/charts/Charts";
import type { ProgressModel } from "@/lib/analytics/useProgress";
import type { SubjectId } from "@/lib/content/schema";
import { SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { cn, formatMarks, pct } from "@/lib/utils";
import type { RevisionItemRow } from "@/lib/userdata/db";
import { mockAttemptLabels, type MockScorePoint } from "./mocks";
import { shortDate } from "./useStudentData";
import { TrendLine } from "./TrendLine";
import { MetricBars } from "./MetricBars";

export function PageSkeleton({ blocks = 3, label = "Loading your progress…" }: { blocks?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius)] bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: blocks }, (_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-[var(--radius)] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export function StorageUnavailable() {
  return (
    <Callout tone="warning" title="Progress cannot be saved in this browser window">
      Your browser is blocking local storage (IndexedDB), which usually happens in a private window or when site data is disabled. You can still read and attempt questions, but nothing is
      recorded. Open the site in a normal window to track progress.
    </Callout>
  );
}

/** Percentage with no decimals for axis ticks and compact labels. */
export const pct0 = (x: number) => `${Math.round(x * 100)}%`;

/** Where a revision item lives (same convention as the subject pages' revision panel). */
export function revisionHref(r: Pick<RevisionItemRow, "kind" | "refId" | "subjectId">): string {
  // Ids come from IndexedDB (possibly an imported backup), so encode them.
  const id = encodeURIComponent(r.refId);
  if (r.kind === "question") return `/questions/${id}`;
  if (r.kind === "concept") return `/concepts/${id}`;
  return r.subjectId ? `/formulas/${encodeURIComponent(r.subjectId)}#${id}` : "/formulas";
}

/** Mock score as % of each mock's maximum, over submitted attempts in date order. */
export function MockScoreChart({
  series,
  title = "Mock score trend",
  className,
  availableCount,
  next,
}: {
  series: MockScorePoint[];
  title?: string;
  className?: string;
  /** Mocks open to take now (for an honest empty state). */
  availableCount: number;
  /** The first open mock not taken yet. */
  next: { id: string; number: number; shortTitle: string } | null;
}) {
  if (!series.length) {
    return (
      <EmptyState
        className={cn("self-start", className)}
        title="No mock test submitted yet"
        action={
          <ButtonLink href={next ? `/mocks/${next.id}` : "/mocks"} variant="primary" size="sm" className="max-sm:h-10">
            {next ? `Start Mock ${next.number}` : "See the mock tests"}
          </ButtonLink>
        }
      >
        Your score trend appears here after you submit your first mock.{" "}
        {availableCount === 0
          ? "No mock test is open yet: each one opens once every question in it has been verified."
          : next
            ? `Mock ${next.number} (${next.shortTitle}) is a good place to start.`
            : ""}
      </EmptyState>
    );
  }
  const negative = series.some((p) => p.ratio < 0);
  const labels = mockAttemptLabels(series);
  const retakes = labels.some((l) => l.short.includes("("));
  const last = series[series.length - 1];
  return (
    <ChartFrame
      className={className}
      title={title}
      description={
        <>
          Score as a percentage of each mock&apos;s maximum marks, in the order you submitted them (M4 = Mock 4{retakes ? "; “(2nd)” marks a retake" : ""}). Mocks get harder tier
          by tier, so compare mocks within a tier.
          {negative ? " Scores below zero are drawn at 0%; the table shows exact values." : ""}
          {series.length === 1 ? " Submit another mock to see a trend." : ""}
        </>
      }
      table={{
        columns: ["Mock", "Submitted", "Score", "Max", "Score %"],
        rows: series.map((p, i) => [labels[i].long, shortDate(p.day), formatMarks(p.score), formatMarks(p.maxScore), pct0(p.ratio)]),
      }}
    >
      <TrendLine
        ariaLabel={`${title}: ${series.map((p, i) => `${labels[i].long} ${pct0(p.ratio)}`).join(", ")}`}
        points={series.map((p, i) => ({
          key: p.attemptId,
          label: labels[i].short,
          value: Math.max(0, p.ratio * 100),
          detail: `${labels[i].long} · ${formatMarks(p.score)} of ${formatMarks(p.maxScore)} marks · ${shortDate(p.day)}`,
        }))}
        formatValue={(v) => `${Math.round(v)}%`}
      />
      <p className="mt-2 text-xs text-fg-3">
        Latest:{" "}
        <Link href={`/mocks/${last.testId}/results/${last.attemptId}`} className="font-medium text-accent-text hover:underline">
          Mock {last.number} results
        </Link>
      </p>
    </ChartFrame>
  );
}

// ------------------------------------------------------------------ PYQ completion

export function PyqCompletion({ model, className }: { model: Pick<ProgressModel, "subjects">; className?: string }) {
  const rows = model.subjects.filter((s) => s.pyqTotal > 0);
  if (!rows.length) return null;
  return (
    <ChartFrame
      className={className}
      title="PYQ completion by subject"
      description="Share of each subject's loaded official PYQs you have attempted."
      table={{ columns: ["Subject", "Attempted", "Loaded PYQs", "Completion"], rows: rows.map((s) => [s.name, s.pyqDone, s.pyqTotal, pct(s.pyqDone / s.pyqTotal)]) }}
    >
      <MetricBars
        ariaLabel="PYQ completion by subject"
        max={1}
        data={rows.map((s) => ({
          key: s.subjectId,
          label: SUBJECT_SHORT[s.subjectId as SubjectId] ?? s.name,
          value: s.pyqDone / s.pyqTotal,
          display: `${s.pyqDone}/${s.pyqTotal}`,
          detail: pct0(s.pyqDone / s.pyqTotal),
          color: SUBJECT_COLOR[s.subjectId as SubjectId],
        }))}
      />
    </ChartFrame>
  );
}
