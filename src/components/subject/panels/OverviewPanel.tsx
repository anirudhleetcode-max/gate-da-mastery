"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { weakTopics } from "@/lib/analytics/stats";
import { useErrorLogs } from "@/lib/userdata/hooks";
import { MISTAKE_LABELS, localDay } from "@/lib/userdata/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { formatDate, pct, plural } from "@/lib/utils";
import { AccuracyValue, Metric, OfficialSyllabusText, WeightageTable } from "../bits";
import { TabLink } from "../tabNav";
import { DataStatusNote, topicHref, type PanelProps } from "./common";

const STATUS_LABEL = { open: "Open", revising: "Revising", resolved: "Resolved" } as const;
const STATUS_TONE = { open: "danger", revising: "warning", resolved: "success" } as const;

export function OverviewPanel({ data, model, status }: PanelProps) {
  const s = data.subject;
  const sp = model.subjects.find((x) => x.subjectId === s.id);
  const topicName = useMemo(() => new Map(data.topics.map((t) => [t.id, t.name])), [data.topics]);
  const weak = useMemo(() => weakTopics(model.attempts.filter((a) => a.subjectId === s.id && a.status !== "not_scored")), [model.attempts, s.id]);
  const errorLogs = useErrorLogs();
  const mistakes = useMemo(() => errorLogs.filter((e) => e.subjectId === s.id).slice(0, 5), [errorLogs, s.id]);
  const ready = status === "ready";
  const done = sp?.pyqDone ?? 0;
  const total = sp?.pyqTotal ?? data.pyqs.length;
  const subtopicCount = data.topics.reduce((a, t) => a + t.subtopics.length, 0);
  const paperCount = new Set(data.pyqs.map((q) => q.paperId)).size;
  const conceptsByTopic = data.topics.map((t) => ({ topic: t, concepts: data.concepts.filter((c) => c.topicId === t.id) })).filter((g) => g.concepts.length);

  return (
    <div className="space-y-5">
      <DataStatusNote status={status} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Official PYQs" value={data.pyqs.length} hint={paperCount ? `from ${plural(paperCount, "paper")}` : "none in the bank yet"} />
        <Metric label="Your PYQ completion" value={ready ? `${done} / ${total}` : "—"} hint={ready ? (done ? "distinct PYQs attempted" : "none attempted yet") : undefined}>
          {ready && total ? <ProgressBar value={done} max={total} label={`Your PYQ completion in ${s.name}`} className="mt-2" tone={done === total ? "success" : "accent"} /> : null}
        </Metric>
        <Metric
          label="Your accuracy"
          value={ready && sp ? <AccuracyValue correct={sp.correct} attempted={sp.attempted} /> : "—"}
          hint={ready ? (sp?.attempted ? "all answered questions in this subject" : "no answers yet") : undefined}
        />
        <Metric label="Topics" value={data.topics.length} hint={`${subtopicCount} official syllabus phrases`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Official syllabus" description="The syllabus section exactly as published for GATE DA." />
            <CardBody>
              <OfficialSyllabusText heading={s.officialName} text={s.officialText} status={s.syllabusStatus} sources={s.sources} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historical weightage" description="Historical estimate from classified official PYQs, per paper." />
            <CardBody>
              {data.weightage ? (
                <WeightageTable w={data.weightage} subjectName={s.name} />
              ) : (
                <p className="text-sm text-fg-3">No official questions from this subject are classified yet, so no historical weightage can be computed.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Concepts" description={data.concepts.length ? `${plural(data.concepts.length, "concept note")} in this subject` : undefined} />
            <CardBody>
              {conceptsByTopic.length ? (
                <div className="space-y-4">
                  {conceptsByTopic.map(({ topic, concepts }) => (
                    <div key={topic.id}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-3">{topic.name}</h3>
                      <ul className="mt-1.5 flex flex-wrap gap-2">
                        {concepts.map((c) => (
                          <li key={c.id}>
                            <Link href={`/concepts/${c.id}`} className="inline-flex min-h-8 items-center rounded-md border border-border px-2.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg">
                              {c.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-fg-3">
                  The concept library has no notes for {s.name} yet. Every PYQ solution explains the concept it tests, so the{" "}
                  <TabLink tab="pyqs">PYQs</TabLink> are the best place to learn this subject for now.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Your weak topics" description="3+ answers and below 70% accuracy, weakest first." />
            <CardBody>
              {!ready ? (
                <DataStatusNote status={status} quiet />
              ) : weak.length ? (
                <ul className="space-y-2.5">
                  {weak.map((w) => (
                    <li key={w.topicId} className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={topicHref(s.id, w.topicId)} className="min-w-0 font-medium text-fg hover:underline">
                        {topicName.get(w.topicId) ?? w.topicId}
                      </Link>
                      <span className="tnum shrink-0 text-fg-2">
                        {pct(w.accuracy, 0)} <span className="text-xs text-fg-3">({w.correct}/{w.attempted})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">
                  {sp?.attempted
                    ? "No weak topics: every topic where you have answered 3 or more questions is at 70% accuracy or above."
                    : "Weak topics appear once you have answered at least 3 questions in a topic."}
                </p>
              )}
              {ready ? (
                <p className="mt-3 text-sm">
                  <TabLink tab="weak-areas">All topics by weakness</TabLink>
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent mistakes"
              action={
                <Link href="/errors" className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                  Error log <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <CardBody>
              {!ready ? (
                <DataStatusNote status={status} quiet />
              ) : mistakes.length ? (
                <ul className="divide-y divide-border">
                  {mistakes.map((m) => (
                    <li key={m.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/questions/${m.questionId}`} className="min-w-0 text-sm font-medium text-fg hover:underline">
                          {m.title}
                        </Link>
                        <Badge tone={STATUS_TONE[m.revisionStatus]} className="shrink-0">
                          {STATUS_LABEL[m.revisionStatus]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-fg-3">
                        {m.mistakeType ? MISTAKE_LABELS[m.mistakeType] : "Mistake type not set"} · {topicName.get(m.topicId) ?? m.topicId} · {formatDate(localDay(new Date(m.createdAt)))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">No mistakes from {s.name} are in your error log. Questions you answer incorrectly are logged there so you can note what went wrong.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Related formulas"
              action={
                data.formulas.length ? (
                  <Link href={`/formulas/${s.id}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                    All {data.formulas.length} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              {data.formulas.length ? (
                <ul className="space-y-1.5">
                  {data.formulas.slice(0, 6).map((f) => (
                    <li key={f.id} className="text-sm">
                      <Link href={`/formulas/${s.id}#${f.id}`} className="text-accent-text hover:underline">
                        {f.name}
                      </Link>
                      <span className="text-xs text-fg-3"> · {topicName.get(f.topicId) ?? f.topicId}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">
                  The formula book has no entries for {s.name} yet. <Link href="/formulas" className="font-medium text-accent-text hover:underline">Browse the formula book</Link> for the subjects that are covered.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
