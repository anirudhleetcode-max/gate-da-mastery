"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Flag } from "lucide-react";
import type { QuestionPayload } from "@/lib/server/payload";
import type { SubjectId } from "@/lib/content/schema";
import type { MockAttemptRow } from "@/lib/userdata/db";
import type { GroupStat } from "@/lib/scoring/score";
import {
  MEDIAN_MIN_QUESTIONS,
  REVIEW_FILTER_LABEL,
  SLOW_MEDIAN_FLOOR_MS,
  SLOW_VS_ESTIMATE,
  SLOW_VS_MEDIAN,
  STATUS_LABEL,
  WEAK_TOPIC_MIN_QUESTIONS,
  WEAK_TOPIC_THRESHOLD,
  matchesReviewFilter,
  timePerSubject,
  type Diagnostics,
  type HistoryTopic,
  type MockTopicStat,
  type ReviewFilter,
  type ScoredQuestion,
} from "@/lib/mock/analysis";
import { formatSeconds, signedMarks } from "@/lib/mock/format";
import { DIFFICULTY_LABEL, SUBJECT_ABBR, SUBJECT_COLOR, SUBJECT_ORDER, SUBJECT_SHORT } from "@/lib/labels";
import { BarList, ChartFrame, GroupedColumns } from "@/components/charts/Charts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Badge } from "@/components/ui/Badge";
import { formatMarks, pct, cn } from "@/lib/utils";
import { ReviewQuestion, StatusIcon } from "./ReviewQuestion";

type OpenFn = (id: string) => void;

function SectionHeading({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold text-fg">
        {title}
      </h2>
      {children ? <p className="mt-0.5 max-w-3xl text-sm text-fg-2">{children}</p> : null}
    </div>
  );
}

/** A compact button that opens a question in the review list below. */
function QChip({ item, onOpen, children }: { item: ScoredQuestion; onOpen: OpenFn; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-left text-sm hover:border-border-strong hover:bg-surface-2"
      aria-label={`Question ${item.n}, ${STATUS_LABEL[item.status].toLowerCase()}: open in the review below`}
    >
      <StatusIcon status={item.status} className="h-3.5 w-3.5" />
      <span className="tnum font-semibold text-fg">Q{item.n}</span>
      {children ? <span className="tnum text-fg-2">{children}</span> : null}
    </button>
  );
}

function ChipList({ items, onOpen, render }: { items: ScoredQuestion[]; onOpen: OpenFn; render?: (i: ScoredQuestion) => ReactNode }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.id}>
          <QChip item={i} onOpen={onOpen}>
            {render?.(i)}
          </QChip>
        </li>
      ))}
    </ul>
  );
}

const bySubjectOrder = <T extends { key?: string; subjectId?: string }>(rows: T[], keyOf: (r: T) => string) =>
  [...rows].sort((a, b) => SUBJECT_ORDER.indexOf(keyOf(a) as SubjectId) - SUBJECT_ORDER.indexOf(keyOf(b) as SubjectId));

// ------------------------------------------------------------------ subject performance

export function SubjectPerformance({ bySubject }: { bySubject: GroupStat[] }) {
  const rows = bySubjectOrder(bySubject, (g) => g.key);
  const name = (k: string) => SUBJECT_SHORT[k as SubjectId] ?? k;
  return (
    <section aria-labelledby="subj-h">
      <SectionHeading id="subj-h" title="Subject performance" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Accuracy by subject"
          description="Correct ÷ attempted questions in this mock"
          table={{
            columns: ["Subject", "Questions", "Attempted", "Correct", "Incorrect", "Skipped", "Accuracy"],
            rows: rows.map((g) => [name(g.key), g.total, g.attempted, g.correct, g.incorrect, g.unanswered, pct(g.accuracy, 0)]),
          }}
        >
          <BarList
            ariaLabel="Accuracy by subject"
            max={100}
            data={rows.map((g) => ({
              key: g.key,
              label: name(g.key),
              value: g.accuracy === null ? 0 : g.accuracy * 100,
              display: g.accuracy === null ? "—" : pct(g.accuracy, 0),
              detail: g.attempted ? `${g.correct} of ${g.attempted} attempted correct` : `None of ${g.total} attempted`,
              color: SUBJECT_COLOR[g.key as SubjectId],
            }))}
          />
        </ChartFrame>
        <ChartFrame
          title="Marks by subject"
          description="Net marks (after negative marking) out of the subject's marks in this mock"
          table={{
            columns: ["Subject", "Net marks", "Available", "Share"],
            rows: rows.map((g) => [name(g.key), formatMarks(g.marks), formatMarks(g.maxMarks), g.maxMarks ? pct(Math.max(0, g.marks) / g.maxMarks, 0) : "—"]),
          }}
        >
          <BarList
            ariaLabel="Net marks by subject as a share of the subject's marks"
            max={100}
            data={rows.map((g) => ({
              key: g.key,
              label: name(g.key),
              value: g.maxMarks ? (Math.max(0, g.marks) / g.maxMarks) * 100 : 0,
              display: `${formatMarks(g.marks)}/${formatMarks(g.maxMarks)}`,
              detail: `${formatMarks(g.marks)} of ${formatMarks(g.maxMarks)} marks`,
              color: SUBJECT_COLOR[g.key as SubjectId],
            }))}
          />
        </ChartFrame>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ weak topics

function topicHref(subjectId: string, topicId: string) {
  return `/subjects/${subjectId}/topics/${topicId}`;
}

export function WeakTopicsPanel({ here, history, items }: { here: MockTopicStat[]; history: HistoryTopic[]; items: ScoredQuestion[] }) {
  const topicInfo = new Map(items.map((i) => [i.topicId, { name: i.topicName, subjectId: i.subjectId }]));
  const multiQuestionTopics = new Set(items.map((i) => i.topicId).filter((t, _, all) => all.filter((x) => x === t).length >= WEAK_TOPIC_MIN_QUESTIONS)).size;
  return (
    <section aria-labelledby="weak-h">
      <SectionHeading id="weak-h" title="Weak topics" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader as="h3" title="In this mock" description={`Topics with ${WEAK_TOPIC_MIN_QUESTIONS} or more questions here and accuracy below ${WEAK_TOPIC_THRESHOLD * 100}% (or all skipped).`} />
          <CardBody>
            {here.length ? (
              <ul className="divide-y divide-border">
                {here.map((t) => (
                  <li key={t.topicId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <Badge tone="outline" className="mr-1.5">
                        {SUBJECT_ABBR[t.subjectId]}
                      </Badge>
                      <Link href={topicHref(t.subjectId, t.topicId)} className="text-sm font-medium text-fg hover:underline">
                        {t.topicName}
                      </Link>
                    </span>
                    <span className="tnum text-sm text-fg-2">
                      {t.attempted ? `${t.correct} of ${t.attempted} correct (${pct(t.accuracy, 0)})` : "not attempted"}
                      {t.total - t.attempted > 0 && t.attempted ? ` · ${t.total - t.attempted} skipped` : ""}
                      {!t.attempted ? ` · ${t.total} questions` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">
                {multiQuestionTopics
                  ? `None: every topic with ${WEAK_TOPIC_MIN_QUESTIONS} or more questions in this mock had an accuracy of at least ${WEAK_TOPIC_THRESHOLD * 100}%.`
                  : `No topic has ${WEAK_TOPIC_MIN_QUESTIONS} or more questions in this mock, so no topic-level conclusion is drawn. Check single mistakes in the question review.`}
              </p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            as="h3"
            title="Repeatedly wrong across your history"
            description={`Topics of this mock where all your answers so far (PYQs, practice, revision, mocks) include 3 or more attempts, accuracy below ${WEAK_TOPIC_THRESHOLD * 100}% and at least 2 wrong.`}
          />
          <CardBody>
            {history.length ? (
              <ul className="divide-y divide-border">
                {history.map((t) => {
                  const info = topicInfo.get(t.topicId);
                  return (
                    <li key={t.topicId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        {info ? (
                          <Badge tone="outline" className="mr-1.5">
                            {SUBJECT_ABBR[info.subjectId]}
                          </Badge>
                        ) : null}
                        <Link href={info ? topicHref(info.subjectId, t.topicId) : "/subjects"} className="text-sm font-medium text-fg hover:underline">
                          {info?.name ?? t.topicId}
                        </Link>
                      </span>
                      <span className="tnum text-sm text-fg-2">
                        {t.incorrect} wrong of {t.attempted} ({pct(t.accuracy, 0)} correct)
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">None of this mock&apos;s topics meets the rule yet. It needs at least 3 answered questions in a topic across your practice.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ strategy diagnostics

function DiagCard({ title, summary, children }: { title: string; summary: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader as="h3" title={title} />
      <CardBody className="flex-1 space-y-3">
        <p className="text-sm text-fg-2">{summary}</p>
        {children}
      </CardBody>
    </Card>
  );
}

export function StrategyPanel({ d, items, confidenceRecorded, negativeMarking, onOpen }: { d: Diagnostics; items: ScoredQuestion[]; confidenceRecorded: boolean; negativeMarking: boolean; onOpen: OpenFn }) {
  const skippedTotal = items.filter((i) => i.status === "unanswered").length;
  return (
    <section aria-labelledby="strategy-h">
      <SectionHeading id="strategy-h" title="Exam strategy analytics">
        Facts about how you used time, confidence and skips in this attempt. Difficulty levels are platform-estimated. Select a question number to open it in the review below.
      </SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <DiagCard
          title="Time sinks"
          summary={
            d.slow.length ? (
              <>
                {d.slow.length} {d.slow.length === 1 ? "question" : "questions"} took more than {SLOW_VS_ESTIMATE}× the estimated time
                {d.medianTimeMs !== null ? ` or more than ${SLOW_VS_MEDIAN}× your median of ${formatSeconds(d.medianTimeMs / 1000)} per answered question` : ""}.
              </>
            ) : (
              <>
                No question took more than {SLOW_VS_ESTIMATE}× its estimated time
                {d.medianTimeMs !== null ? ` or more than ${SLOW_VS_MEDIAN}× your median (${formatSeconds(d.medianTimeMs / 1000)})` : ""}.
              </>
            )
          }
        >
          {d.slow.length ? (
            <ul className="space-y-1.5">
              {d.slow.map((s) => (
                <li key={s.item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
                  <QChip item={s.item} onOpen={onOpen}>
                    {formatSeconds(s.item.timeSpentMs / 1000)}
                  </QChip>
                  <span>
                    estimate {formatSeconds(s.item.estimatedTimeSec)} · {STATUS_LABEL[s.item.status].toLowerCase()}
                    {s.overEstimate && s.overMedian ? " · over both limits" : s.overEstimate ? ` · over ${SLOW_VS_ESTIMATE}× estimate` : ` · over ${SLOW_VS_MEDIAN}× median`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {d.medianTimeMs === null ? (
            <p className="text-xs text-fg-3">The median rule needs at least {MEDIAN_MIN_QUESTIONS} answered questions.</p>
          ) : (
            <p className="text-xs text-fg-3">The median rule only flags questions above {formatSeconds(SLOW_MEDIAN_FLOOR_MS / 1000)}.</p>
          )}
        </DiagCard>

        <DiagCard
          title="Wrong with high confidence"
          summary={
            !confidenceRecorded
              ? "You did not record confidence in this attempt. Mark it during your next mock to find answers you were sure of but got wrong."
              : d.highConfidenceWrong.length
                ? `${d.highConfidenceWrong.length} ${d.highConfidenceWrong.length === 1 ? "answer" : "answers"} you rated high confidence ${d.highConfidenceWrong.length === 1 ? "was" : "were"} wrong. These usually point to a misunderstood concept rather than a slip.`
                : "None: every answer you rated high confidence was correct or skipped."
          }
        >
          {d.highConfidenceWrong.length ? <ChipList items={d.highConfidenceWrong} onOpen={onOpen} render={(i) => SUBJECT_ABBR[i.subjectId]} /> : null}
        </DiagCard>

        <DiagCard
          title="Skipped questions"
          summary={
            skippedTotal
              ? `${skippedTotal} ${skippedTotal === 1 ? "question was" : "questions were"} skipped.`
              : "You attempted every question."
          }
        >
          {d.skippedHard.length ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Hard or very hard: a reasonable skip ({d.skippedHard.length})</p>
              <ChipList items={d.skippedHard} onOpen={onOpen} render={(i) => DIFFICULTY_LABEL[i.difficulty]} />
            </div>
          ) : null}
          {d.skippedEasy.length ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">
                Easy or moderate: possible missed marks ({d.skippedEasy.length}, worth {formatMarks(d.skippedEasyMarks)})
              </p>
              <ChipList items={d.skippedEasy} onOpen={onOpen} render={(i) => DIFFICULTY_LABEL[i.difficulty]} />
            </div>
          ) : null}
        </DiagCard>

        <DiagCard
          title="Negative marking"
          summary={
            !negativeMarking
              ? "This mock has no negative marking."
              : d.penalised.length
                ? (
                    <>
                      <span className="tnum font-semibold text-danger">−{formatMarks(d.totalPenalty)}</span> {d.totalPenalty === 1 ? "mark" : "marks"} lost on {d.penalised.length} wrong{" "}
                      {d.penalised.length === 1 ? "MCQ" : "MCQs"}. MSQ and NAT answers carry no penalty.
                    </>
                  )
                : "No marks were lost to negative marking."
          }
        >
          {d.penalised.length ? <ChipList items={d.penalised} onOpen={onOpen} render={(i) => signedMarks(i.awarded)} /> : null}
        </DiagCard>

        <DiagCard
          title="Repeated mistakes"
          summary={
            d.repeatedQuestions.length || d.repeatedTopics.length
              ? "Wrong here, and also wrong in your earlier attempts."
              : "None: no wrong answer here repeats an earlier mistake on the same question or topic."
          }
        >
          {d.repeatedQuestions.length ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Same question, wrong before</p>
              <ChipList items={d.repeatedQuestions.map((r) => r.item)} onOpen={onOpen} render={(i) => `${d.repeatedQuestions.find((r) => r.item.id === i.id)!.earlierWrong}× before`} />
            </div>
          ) : null}
          {d.repeatedTopics.length ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Topics with repeated mistakes</p>
              <ul className="space-y-1 text-sm">
                {d.repeatedTopics.map((t) => (
                  <li key={t.topicId} className="flex flex-wrap justify-between gap-x-3">
                    <Link href={topicHref(t.subjectId, t.topicId)} className="font-medium text-fg hover:underline">
                      {t.topicName}
                    </Link>
                    <span className="tnum text-fg-2">
                      {t.wrongHere} wrong here · {t.wrongEarlier} before
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DiagCard>

        {d.markedUnanswered.length ? (
          <DiagCard
            title="Marked for review, never answered"
            summary={`${d.markedUnanswered.length} ${d.markedUnanswered.length === 1 ? "question was" : "questions were"} marked to revisit but left unanswered at the end.`}
          >
            <ChipList items={d.markedUnanswered} onOpen={onOpen} render={(i) => DIFFICULTY_LABEL[i.difficulty]} />
          </DiagCard>
        ) : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ time analysis

export function TimeAnalysis({ items }: { items: ScoredQuestion[] }) {
  const subjects = bySubjectOrder(timePerSubject(items), (s) => s.subjectId);
  const maxSec = Math.max(1, ...subjects.map((s) => s.totalMs / 1000));
  return (
    <section aria-labelledby="time-h">
      <SectionHeading id="time-h" title="Time analysis">
        Time counts while a question is on screen and the tab is visible.
      </SectionHeading>
      <div className="space-y-4">
        <ChartFrame
          title="Time per question"
          description="Your time against the platform's estimated time"
          legend={[
            { label: "Your time", color: "var(--ord-3)" },
            { label: "Estimated time", color: "var(--ord-1)" },
          ]}
          table={{
            columns: ["Question", "Subject", "Result", "Your time", "Estimate"],
            rows: items.map((i) => [`Q${i.n}`, SUBJECT_ABBR[i.subjectId], STATUS_LABEL[i.status], formatSeconds(i.timeSpentMs / 1000), formatSeconds(i.estimatedTimeSec)]),
          }}
        >
          <GroupedColumns
            ariaLabel="Time per question: your time and estimated time"
            categories={items.map((i) => `Q${i.n}`)}
            series={[
              { key: "you", label: "Your time", color: "var(--ord-3)", values: items.map((i) => Math.round(i.timeSpentMs / 1000)) },
              { key: "est", label: "Estimated time", color: "var(--ord-1)", values: items.map((i) => i.estimatedTimeSec) },
            ]}
            formatValue={formatSeconds}
          />
        </ChartFrame>
        <ChartFrame
          title="Time per subject"
          description="Total time on each subject's questions"
          table={{
            columns: ["Subject", "Questions", "Marks", "Total time", "Average per question"],
            rows: subjects.map((s) => [SUBJECT_SHORT[s.subjectId], s.questions, s.marks, formatSeconds(s.totalMs / 1000), formatSeconds(s.avgMs / 1000)]),
          }}
        >
          <BarList
            ariaLabel="Total time per subject"
            max={maxSec}
            data={subjects.map((s) => ({
              key: s.subjectId,
              label: SUBJECT_SHORT[s.subjectId],
              value: s.totalMs / 1000,
              display: formatSeconds(s.totalMs / 1000),
              detail: `${s.questions} ${s.questions === 1 ? "question" : "questions"}, average ${formatSeconds(s.avgMs / 1000)}`,
              color: SUBJECT_COLOR[s.subjectId],
            }))}
          />
        </ChartFrame>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ question review

const FILTERS: ReviewFilter[] = ["all", "correct", "incorrect", "skipped", "marked"];

export function QuestionReview({
  questions,
  items,
  attempt,
  filter,
  onFilter,
  openId,
  onToggle,
}: {
  questions: QuestionPayload[];
  items: ScoredQuestion[];
  attempt: MockAttemptRow;
  filter: ReviewFilter;
  onFilter: (f: ReviewFilter) => void;
  openId: string | null;
  onToggle: (id: string) => void;
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const counts = Object.fromEntries(FILTERS.map((f) => [f, items.filter((i) => matchesReviewFilter(i, f)).length])) as Record<ReviewFilter, number>;
  const shown = items.filter((i) => matchesReviewFilter(i, filter));
  return (
    <section aria-labelledby="review-h">
      <SectionHeading id="review-h" title="Question review">
        Your response against the correct answer, with the full solution. Mock questions also open on their own page for concepts, formulas and similar questions.
      </SectionHeading>
      <div className="mb-3 overflow-x-auto pb-1">
        <Segmented label="Filter questions" value={filter} onChange={onFilter} options={FILTERS.map((f) => ({ value: f, label: `${REVIEW_FILTER_LABEL[f]} (${counts[f]})` }))} />
      </div>
      <p className="sr-only" role="status">
        {shown.length} {shown.length === 1 ? "question" : "questions"} shown
      </p>
      {shown.length ? (
        <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
          {shown.map((i) => {
            const q = byId.get(i.id)!;
            const open = openId === i.id;
            const panelId = `review-panel-${i.id}`;
            return (
              <li key={i.id} id={`review-${i.id}`} className="scroll-mt-20">
                <h3>
                  <button
                    type="button"
                    id={`review-btn-${i.id}`}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => onToggle(i.id)}
                    className={cn("flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface-2 sm:px-4", open && "bg-surface-2")}
                  >
                    <span className="tnum w-9 shrink-0 pt-0.5 text-sm font-semibold text-fg">Q{i.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3">
                        <span className="inline-flex items-center gap-1 font-medium text-fg-2">
                          <StatusIcon status={i.status} className="h-3.5 w-3.5" />
                          {STATUS_LABEL[i.status]}
                        </span>
                        <span>{i.type}</span>
                        <span>{SUBJECT_ABBR[i.subjectId]}</span>
                        <span className="tnum">{formatSeconds(i.timeSpentMs / 1000)}</span>
                        {i.markedForReview ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Flag aria-hidden className="h-3 w-3" /> Marked
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-fg-2">{q.preview}</span>
                    </span>
                    <span className={cn("tnum shrink-0 pt-0.5 text-sm font-semibold", i.awarded > 0 ? "text-success" : i.awarded < 0 ? "text-danger" : "text-fg-3")}>{signedMarks(i.awarded)}</span>
                    <ChevronDown aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0 text-fg-3 transition-transform", open && "rotate-180")} />
                  </button>
                </h3>
                {open ? (
                  <div id={panelId} role="region" aria-labelledby={`review-btn-${i.id}`} className="border-t border-border px-3 py-4 sm:px-5">
                    <ReviewQuestion q={q} item={i} state={attempt.questions[i.id]} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[var(--radius)] border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-fg-3">No questions in this category.</p>
      )}
    </section>
  );
}
