"use client";
/**
 * Small building blocks shared by the dashboard, progress, today and practice
 * pages.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BarList, ChartFrame, LineChart } from "@/components/charts/Charts";
import type { ProgressModel } from "@/lib/analytics/useProgress";
import type { SubjectId } from "@/lib/content/schema";
import { SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { formatMarks, pct } from "@/lib/utils";
import type { MockScorePoint } from "./mocks";
import { shortDate } from "./useStudentData";

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

/**
 * The shared LineChart labels every ceil(n/6)-th point plus the last one; when
 * the last regular label sits right next to the final one they overlap. Blank
 * that one regular label (the table view still lists every point).
 * Shared-chart follow-up: anchor the last x label at "end" in LineChart.
 */
export function spacedLabels(labels: string[]): string[] {
  const n = labels.length;
  if (n < 2) return labels;
  const out = [...labels];
  const every = Math.ceil(n / 6);
  const lastRegular = Math.floor((n - 1) / every) * every;
  if (n > 2 && lastRegular !== n - 1 && n - 1 - lastRegular < Math.max(2, every * 0.6)) out[lastRegular] = "";
  // The last label is centred on the right edge and would be clipped; two
  // trailing figure spaces shift its visible text left by about one digit.
  if (out[n - 1].length >= 5) out[n - 1] = `${out[n - 1]}\u2007\u2007`;
  return out;
}

/** Percentage with no decimals for axis ticks and compact labels. */
export const pct0 = (x: number) => `${Math.round(x * 100)}%`;

/** A section heading row used inside page grids. */
export function SectionTitle({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 id={id} className="text-base font-semibold text-fg">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Mock score as % of each mock's maximum, over submitted attempts in date order. */
export function MockScoreChart({ series, title = "Mock score trend", className }: { series: MockScorePoint[]; title?: string; className?: string }) {
  if (!series.length) {
    return (
      <EmptyState
        className={className}
        title="No mock test submitted yet"
        action={
          <ButtonLink href="/mocks" variant="primary" size="sm">
            See the mock tests
          </ButtonLink>
        }
      >
        Your score trend appears here after you submit your first mock. Start with Mock 1, a short foundation test.
      </EmptyState>
    );
  }
  const negative = series.some((p) => p.ratio < 0);
  return (
    <ChartFrame
      className={className}
      title={title}
      description={
        <>
          Score as a percentage of each mock&apos;s maximum marks, in the order you submitted them (M4 = Mock 4). Mocks get harder tier by tier, so compare mocks within a tier.
          {negative ? " Scores below zero are drawn at 0%; the table shows exact values." : ""}
          {series.length === 1 ? " Submit another mock to see a trend." : ""}
        </>
      }
      table={{
        columns: ["Mock", "Submitted", "Score", "Max", "Score %"],
        rows: series.map((p) => [`Mock ${p.number}`, shortDate(p.day), formatMarks(p.score), formatMarks(p.maxScore), pct0(p.ratio)]),
      }}
    >
      <LineChart
        ariaLabel={`${title}: ${series.map((p) => `Mock ${p.number} ${pct0(p.ratio)}`).join(", ")}`}
        xLabels={series.map((p) => `M${p.number}`)}
        series={[{ key: "score", label: "Score", color: "var(--accent)", values: series.map((p) => Math.max(0, p.ratio * 100)) }]}
        yMax={100}
        formatValue={(v) => `${Math.round(v)}%`}
      />
      <p className="mt-2 text-xs text-fg-3">
        Latest:{" "}
        <Link href={`/mocks/${series[series.length - 1].testId}/results/${series[series.length - 1].attemptId}`} className="font-medium text-accent-text hover:underline">
          Mock {series[series.length - 1].number} results
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
      <BarList
        ariaLabel="PYQ completion by subject"
        max={1}
        data={rows.map((s) => ({
          key: s.subjectId,
          label: SUBJECT_SHORT[s.subjectId as SubjectId] ?? s.name,
          value: s.pyqDone / s.pyqTotal,
          display: `${s.pyqDone}/${s.pyqTotal}`,
          detail: pct(s.pyqDone / s.pyqTotal),
          color: SUBJECT_COLOR[s.subjectId as SubjectId],
        }))}
      />
    </ChartFrame>
  );
}
