"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MASTERY_MIN_ATTEMPTS } from "@/lib/analytics/stats";
import { plural } from "@/lib/utils";
import { AccuracyValue, MasteryBadge } from "../bits";
import { DataStatusNote, topicHref, type PanelProps } from "./common";

export function TopicsPanel({ data, model, status }: PanelProps) {
  const s = data.subject;
  const progress = new Map(model.topics.map((t) => [t.topicId, t]));
  const ready = status === "ready";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-fg-3">
          {plural(data.topics.length, "topic")}. Topics group the official syllabus phrases (shown in quotes, verbatim); accuracy and mastery come from your own answers.
        </p>
        <DataStatusNote status={status} />
      </div>
      <ol className="space-y-3">
        {data.topics.map((t) => {
          const p = progress.get(t.id);
          const need = p ? Math.max(0, MASTERY_MIN_ATTEMPTS - p.mastery.evidence) : MASTERY_MIN_ATTEMPTS;
          return (
            <li key={t.id} className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)] sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-fg">
                    <Link href={topicHref(s.id, t.id)} className="hover:underline">
                      {t.name}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-sm text-fg-2">{t.summary}</p>
                  <p className="mt-3 text-xs font-medium text-fg-3">Official syllabus phrases</p>
                  <ul className="mt-1 space-y-1">
                    {t.subtopics.map((st) => (
                      <li key={st.id} className="flex gap-2 text-sm text-fg-2">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-3" />
                        <span className="min-w-0">
                          &ldquo;{st.officialPhrase}&rdquo;
                          {st.pyqCount ? <span className="tnum whitespace-nowrap text-xs text-fg-3"> · {plural(st.pyqCount, "PYQ")}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface-2 px-3 py-3 text-sm md:w-72">
                  <div>
                    <dt className="text-xs text-fg-3">Official PYQs</dt>
                    <dd className="tnum font-semibold text-fg">{t.pyqCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-3">Practice questions</dt>
                    <dd className="tnum font-semibold text-fg">{t.practiceCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-3">Your accuracy</dt>
                    <dd className="font-semibold text-fg">{ready && p ? <AccuracyValue correct={p.correct} attempted={p.attempted} /> : <span className="text-fg-3">—</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-3">Your topic mastery</dt>
                    <dd className="mt-0.5">
                      {ready && p ? (
                        <>
                          <MasteryBadge mastery={p.mastery} />
                          {p.mastery.score === null ? <span className="mt-0.5 block text-xs text-fg-3">answer {need} more</span> : null}
                        </>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                <Link href={topicHref(s.id, t.id)} className="inline-flex min-h-8 items-center gap-1 font-medium text-accent-text hover:underline">
                  Open topic <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  <span className="sr-only">: {t.name}</span>
                </Link>
                {t.pyqCount + t.practiceCount > 0 ? (
                  <Link href={`/practice?subject=${s.id}&topic=${t.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                    Practice<span className="sr-only"> {t.name}</span>
                  </Link>
                ) : null}
                {t.formulaCount ? <span className="inline-flex min-h-8 items-center text-fg-3">{plural(t.formulaCount, "formula")}</span> : null}
                {t.conceptCount ? <span className="inline-flex min-h-8 items-center text-fg-3">{plural(t.conceptCount, "concept")}</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
