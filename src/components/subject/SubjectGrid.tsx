"use client";
import Link from "next/link";
import type { Catalog } from "@/lib/server/repo";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { plural } from "@/lib/utils";
import { AccuracyValue, SubjectDot, marksRange, variationTone } from "./bits";
import { useDataStatus } from "./hooks";
import type { SubjectCardData } from "./types";

/** The 8 subjects with content counts, historical weightage and the student's own progress. */
export function SubjectGrid({ subjects, catalog }: { subjects: SubjectCardData[]; catalog: Catalog }) {
  const model = useProgressModel(catalog);
  const status = useDataStatus();
  const bySubject = new Map(model.subjects.map((s) => [s.subjectId, s]));
  const anyAttempts = model.overall.attempted > 0;

  return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-fg-3">
        {status === "loading"
          ? "Loading your progress…"
          : status === "unavailable"
            ? "Your progress cannot be read in this browser window (storage is blocked), so only content figures are shown."
            : anyAttempts
              ? `Your progress: ${model.overall.pyqDone} of ${model.overall.pyqTotal} official PYQs attempted on this device.`
              : "You have not answered any questions on this device yet. Open a subject to start with its PYQs or a short practice set."}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {subjects.map((s) => {
          const p = bySubject.get(s.id);
          const done = p?.pyqDone ?? 0;
          const total = p?.pyqTotal ?? s.pyqCount;
          return (
            <li
              key={s.id}
              className="relative flex min-w-0 flex-col rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)] transition-colors has-[a:hover]:border-border-strong"
            >
              <h2 className="flex items-start gap-2 text-[0.95rem] font-semibold leading-snug text-fg">
                <SubjectDot id={s.id} className="mt-1.5" />
                <Link
                  href={`/subjects/${s.id}`}
                  className="after:absolute after:inset-0 after:rounded-[var(--radius)] hover:underline focus-visible:outline-none! focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[color:var(--focus)]"
                >
                  {s.name}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-fg-3">
                Official section: <span className="text-fg-2">{s.officialName}</span>
              </p>
              <p className="tnum mt-2 text-sm text-fg-2">
                {plural(s.topicCount, "topic")} · {s.pyqCount ? plural(s.pyqCount, "PYQ") : "no PYQs yet"}
                {s.practiceCount ? ` · ${s.practiceCount} practice` : ""}
              </p>
              <div className="mt-2 rounded-md bg-surface-2 px-2.5 py-2 text-xs">
                <p className="font-medium text-fg-3">Historical weightage (estimate)</p>
                {s.weightage ? (
                  <>
                    <p className="mt-0.5 text-sm text-fg-2">
                      <span className="tnum font-semibold text-fg">{marksRange(s.weightage.marksMin, s.weightage.marksMax)}</span> per paper
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-fg-3">
                      <span className="tnum">{plural(s.weightage.papers, "paper")}</span>
                      <Badge tone={variationTone(s.weightage.variation)} title="Year-to-year variation in marks">
                        {s.weightage.variation === "Insufficient data" ? "Too few papers" : `${s.weightage.variation} variation`}
                      </Badge>
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-fg-3">No classified official questions yet.</p>
                )}
              </div>
              <div className="mt-auto space-y-2 pt-3">
                <div>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-fg-3">Your PYQ completion</span>
                    <span className="tnum text-fg-2">{status === "ready" ? `${done} / ${total}` : "—"}</span>
                  </div>
                  <ProgressBar value={status === "ready" ? done : 0} max={Math.max(1, total)} label={`Your PYQ completion in ${s.name}: ${done} of ${plural(total, "PYQ")} attempted`} tone={total > 0 && done === total ? "success" : "accent"} />
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-fg-3">Your accuracy</span>
                  <span className="text-sm font-medium text-fg">{status === "ready" && p ? <AccuracyValue correct={p.correct} attempted={p.attempted} /> : <span className="text-fg-3">—</span>}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
