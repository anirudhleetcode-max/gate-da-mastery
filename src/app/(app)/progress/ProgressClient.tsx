"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { Catalog } from "@/lib/server/repo";
import type { SubjectId } from "@/lib/content/schema";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { MASTERY_HALF_LIFE_DAYS, MASTERY_MIN_ATTEMPTS, accuracyTrend, weakTopics } from "@/lib/analytics/stats";
import { useMockAttempts, useRevisionItems } from "@/lib/userdata/hooks";
import { SUBJECT_COLOR, SUBJECT_SHORT, TIER_LABEL } from "@/lib/labels";
import { formatDuration, pct, plural } from "@/lib/utils";
import { BarList, ChartFrame, LineChart } from "@/components/charts/Charts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { mockProgress, type MockInfo } from "@/components/dashboard/mocks";
import { MockScoreChart, PageSkeleton, PyqCompletion, StorageUnavailable, pct0, spacedLabels } from "@/components/dashboard/parts";
import { PairedBars } from "@/components/dashboard/PairedBars";
import { TopicTable } from "@/components/dashboard/TopicTable";
import { dueLabel, shiftDay, shortDate, useLoadStatus, useToday } from "@/components/dashboard/useStudentData";

const DAILY_POINTS = 60;
const WEAK_WINDOW_DAYS = 30;

export function ProgressClient({ catalog, mocks }: { catalog: Catalog; mocks: MockInfo[] }) {
  const model = useProgressModel(catalog);
  const mockRows = useMockAttempts();
  const revision = useRevisionItems();
  const today = useToday();
  const { status } = useLoadStatus({ attempts: model.attempts, mockAttempts: mockRows, revisionItems: revision });
  const mp = useMemo(() => mockProgress(mocks, mockRows), [mocks, mockRows]);
  const [bucket, setBucket] = useState<"day" | "week">("day");

  const trend = useMemo(() => {
    const all = accuracyTrend(model.attempts, bucket);
    return { points: bucket === "day" ? all.slice(-DAILY_POINTS) : all, capped: bucket === "day" && all.length > DAILY_POINTS };
  }, [model.attempts, bucket]);

  const weakTrend = useMemo(() => {
    if (!today) return null;
    const cutoff = shiftDay(today, -WEAK_WINDOW_DAYS);
    const scored = model.attempts.filter((a) => a.status === "correct" || a.status === "incorrect");
    const before = scored.filter((a) => a.day < cutoff);
    const now = weakTopics(scored, { limit: 50 });
    const then = weakTopics(before, { limit: 50 });
    const nowIds = new Set(now.map((w) => w.topicId));
    const thenIds = new Set(then.map((w) => w.topicId));
    const acc = (rows: typeof scored, topicId: string) => {
      const r = rows.filter((a) => a.topicId === topicId);
      return { n: r.length, value: r.length ? r.filter((a) => a.status === "correct").length / r.length : null };
    };
    const names = new Map(catalog.topics.map((t) => [t.id, t]));
    const rank = { "Still weak": 0, "New weak area": 1, "No longer weak": 2 } as const;
    const statusOf = (id: string): keyof typeof rank => (nowIds.has(id) && thenIds.has(id) ? "Still weak" : nowIds.has(id) ? "New weak area" : "No longer weak");
    const rows = [...new Set([...now.map((w) => w.topicId), ...then.map((w) => w.topicId)])]
      .map((id) => ({
        id,
        name: names.get(id)?.name ?? id,
        subjectId: names.get(id)?.subjectId ?? "",
        then: acc(before, id).value,
        thenN: acc(before, id).n,
        now: acc(scored, id).value,
        nowN: acc(scored, id).n,
        status: statusOf(id),
      }))
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.now ?? 0) - (b.now ?? 0));
    return { cutoff, hasHistory: before.length > 0, rows, nowCount: now.length, thenCount: then.length };
  }, [model.attempts, today, catalog.topics]);

  if (status === "loading" || !today || !weakTrend) return <PageSkeleton blocks={4} label="Loading your analytics…" />;

  const o = model.overall;
  const empty = model.attempts.length === 0 && mp.submittedAttempts === 0 && revision.length === 0;
  if (empty) {
    return (
      <div className="space-y-6">
        {status === "unavailable" ? <StorageUnavailable /> : null}
        <EmptyState
          title="No progress to analyse yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/today" variant="primary">
                Start today&apos;s set
              </ButtonLink>
              <ButtonLink href="/pyqs">Solve official PYQs</ButtonLink>
              <ButtonLink href="/mocks">Take a mock test</ButtonLink>
            </div>
          }
        >
          Every chart on this page is built from your own answers, mock submissions and revision reviews. Answer a few questions and your accuracy, time per question and topic mastery start
          to appear here.
        </EmptyState>
        <MetricsExplainer />
      </div>
    );
  }

  const answeredSubjects = model.subjects.filter((s) => s.attempted > 0);
  const timedSubjects = model.subjects.filter((s) => s.avgTimeMs !== null);
  const reviewsDone = revision.reduce((a, r) => a + r.reviewCount, 0);
  const dueToday = revision.filter((r) => r.nextReview === today).length;
  const overdue = revision.filter((r) => r.nextReview < today);
  const byGrade = [
    { key: "none", label: "Not reviewed yet", color: "var(--border-strong)", n: revision.filter((r) => r.confidence === null).length },
    { key: "forgot", label: "Last: forgot", color: "var(--danger)", n: revision.filter((r) => r.confidence === "forgot").length },
    { key: "almost", label: "Last: almost", color: "var(--warning)", n: revision.filter((r) => r.confidence === "almost").length },
    { key: "got_it", label: "Last: got it", color: "var(--success)", n: revision.filter((r) => r.confidence === "got_it").length },
  ];
  const oldestOverdue = overdue[0];

  return (
    <div className="space-y-8">
      {status === "unavailable" ? <StorageUnavailable /> : null}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Answers" value={o.attempted} hint={o.skipped ? `${o.skipped} skipped in mocks` : `${o.questionsSolved} distinct questions`} />
        <Stat label="Accuracy" value={pct(o.accuracy)} hint={o.attempted ? `${o.correct} right, ${o.incorrect} wrong` : "no answers yet"} />
        <Stat label="Avg time" value={formatDuration(o.avgTimeMs)} hint="per answered question" />
        <Stat label="Study days" value={o.studyDays} hint={`current streak ${plural(o.streak, "day")}`} />
      </section>

      <Section id="trends" title="Trends">
        <MockScoreChart series={mp.series} title="Score trend (mock tests)" />
        {trend.points.length ? (
          <ChartFrame
            title={`Accuracy trend (${bucket === "day" ? "daily" : "weekly"})`}
            description={
              bucket === "day"
                ? `Share of answers correct on each day you studied${trend.capped ? ` (last ${DAILY_POINTS} study days)` : ""}. Days without answers are skipped.`
                : "Share of answers correct in each week (labelled by the Monday that starts it)."
            }
            table={{
              columns: [bucket === "day" ? "Day" : "Week starting", "Answers", "Accuracy"],
              rows: trend.points.map((p) => [shortDate(p.period), p.attempted, pct(p.accuracy)]),
            }}
          >
            <Segmented
              label="Group accuracy by"
              size="sm"
              value={bucket}
              onChange={setBucket}
              options={[
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
              ]}
              className="mb-3"
            />
            <LineChart
              ariaLabel={`Accuracy trend by ${bucket}`}
              xLabels={spacedLabels(trend.points.map((p) => shortDate(p.period)))}
              series={[{ key: "acc", label: "Accuracy", color: "var(--accent)", values: trend.points.map((p) => p.accuracy * 100) }]}
              yMax={100}
              formatValue={(v) => `${Math.round(v)}%`}
            />
          </ChartFrame>
        ) : (
          <EmptyState title="No answered questions yet">Your accuracy trend starts with the first question you answer, in practice or in a mock.</EmptyState>
        )}
      </Section>

      <Section id="subjects" title="Subjects">
        {answeredSubjects.length ? (
          <ChartFrame
            title="Subject performance"
            description={`Accuracy per subject; the number in brackets is how many answers it is based on.${answeredSubjects.length < model.subjects.length ? ` ${plural(model.subjects.length - answeredSubjects.length, "subject")} without answers ${model.subjects.length - answeredSubjects.length === 1 ? "is" : "are"} not shown.` : ""}`}
            table={{ columns: ["Subject", "Answers", "Correct", "Accuracy"], rows: answeredSubjects.map((s) => [s.name, s.attempted, s.correct, pct(s.accuracy)]) }}
          >
            <BarList
              ariaLabel="Accuracy by subject"
              max={1}
              data={answeredSubjects.map((s) => ({
                key: s.subjectId,
                label: `${SUBJECT_SHORT[s.subjectId as SubjectId] ?? s.name} (${s.attempted})`,
                value: s.accuracy ?? 0,
                display: pct0(s.accuracy ?? 0),
                detail: `${s.correct} of ${s.attempted} correct`,
                color: SUBJECT_COLOR[s.subjectId as SubjectId],
              }))}
            />
          </ChartFrame>
        ) : (
          <EmptyState title="No subject data yet">Answer questions in any subject to compare your accuracy across subjects.</EmptyState>
        )}
        {timedSubjects.length ? (
          <ChartFrame
            title="Time per question"
            description={`Average time from opening a question to submitting your answer, per subject. Overall: ${formatDuration(o.avgTimeMs)}. The GATE paper allows about 2 min 46 s per question on average (180 minutes for 65 questions).`}
            table={{ columns: ["Subject", "Answers", "Average time"], rows: timedSubjects.map((s) => [s.name, s.attempted, formatDuration(s.avgTimeMs)]) }}
          >
            <BarList
              ariaLabel="Average time per question by subject"
              data={timedSubjects.map((s) => ({
                key: s.subjectId,
                label: SUBJECT_SHORT[s.subjectId as SubjectId] ?? s.name,
                value: (s.avgTimeMs ?? 0) / 1000,
                display: formatDuration(s.avgTimeMs),
                detail: `${plural(s.attempted, "answer")}`,
                color: SUBJECT_COLOR[s.subjectId as SubjectId],
              }))}
            />
          </ChartFrame>
        ) : (
          <EmptyState title="No timing data yet">Time per question appears once you have answered questions.</EmptyState>
        )}
      </Section>

      <Section id="completion" title="Completion">
        <PyqCompletion model={model} />
        <ChartFrame
          title="Mock completion"
          description={`${mp.taken} of ${mp.totalMocks} mocks submitted at least once; ${mocks.filter((m) => m.available).length} are available now. Each bar shows the mocks of a tier you have taken.`}
          table={{
            columns: ["Tier", "Taken", "Available now", "Mocks in tier"],
            rows: mp.perTier.map((t) => [TIER_LABEL[t.tier], t.taken, mocks.filter((m) => m.tier === t.tier && m.available).length, t.total]),
          }}
        >
          <BarList
            ariaLabel="Mock completion by tier"
            max={1}
            data={mp.perTier.map((t) => ({
              key: t.tier,
              label: TIER_LABEL[t.tier],
              value: t.total ? t.taken / t.total : 0,
              display: `${t.taken}/${t.total}`,
              detail: `${mocks.filter((m) => m.tier === t.tier && m.available).length} available now`,
              color: "var(--accent)",
            }))}
          />
        </ChartFrame>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revision completion"
            description="Your spaced-revision queue: items come back after 1, 3, 7 or more days depending on how well you recalled them."
            action={
              revision.length ? (
                <ButtonLink href="/revision" size="sm" variant={dueToday + overdue.length ? "primary" : "secondary"}>
                  {dueToday + overdue.length ? "Revise now" : "Open revision"}
                </ButtonLink>
              ) : undefined
            }
          />
          <CardBody>
            {revision.length ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="grid grid-cols-2 gap-3 self-start">
                  <Stat label="Reviews done" value={reviewsDone} />
                  <Stat label="In queue" value={revision.length} />
                  <Stat label="Due today" value={dueToday} />
                  <Stat label="Overdue" value={overdue.length} hint={oldestOverdue ? dueLabel(oldestOverdue.nextReview, today).text.toLowerCase() + " (oldest)" : "none"} />
                </div>
                <ChartFrame
                  className="border-0 p-0"
                  title="Queue by last recall"
                  description="How you graded each item the last time you reviewed it."
                  table={{ columns: ["Status", "Items"], rows: byGrade.map((g) => [g.label, g.n]) }}
                >
                  <BarList ariaLabel="Revision items by last recall grade" data={byGrade.map((g) => ({ key: g.key, label: g.label, value: g.n, display: String(g.n), color: g.color }))} />
                </ChartFrame>
              </div>
            ) : (
              <p className="text-sm text-fg-3">
                Your revision queue is empty. Questions you answer incorrectly are added automatically; you can also add any question, concept or formula from its page.
              </p>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section id="weak" title="Weak areas">
        <div className="lg:col-span-2">
          {weakTrend.rows.length && weakTrend.hasHistory ? (
            <ChartFrame
              title={`Weak-area trend: now vs ${WEAK_WINDOW_DAYS} days ago`}
              description={`Accuracy in each topic that is weak now or was weak on ${shortDate(weakTrend.cutoff)}, from the answers you had given by then; "of 5" is the number of answers. ${weakTrend.thenCount} weak then, ${weakTrend.nowCount} weak now.`}
              legend={[
                { label: `${WEAK_WINDOW_DAYS} days ago`, color: "var(--ord-1)" },
                { label: "Now", color: "var(--ord-2)" },
              ]}
              table={{
                columns: ["Topic", `${WEAK_WINDOW_DAYS} days ago`, "Now", "Status"],
                rows: weakTrend.rows.map((r) => [r.name, r.then === null ? "no answers" : `${pct(r.then)} of ${r.thenN}`, r.now === null ? "—" : `${pct(r.now)} of ${r.nowN}`, r.status]),
              }}
            >
              <PairedBars
                ariaLabel="Accuracy per weak topic, 30 days ago and now"
                aLabel={`${WEAK_WINDOW_DAYS} days ago`}
                bLabel="Now"
                aColor="var(--ord-1)"
                bColor="var(--ord-2)"
                format={(v) => pct0(v)}
                data={weakTrend.rows.map((r) => ({
                  key: r.id,
                  label: r.name,
                  a: r.then,
                  b: r.now,
                  aText: r.then === null ? "no answers" : `${pct0(r.then)} of ${r.thenN}`,
                  bText: r.now === null ? "no answers" : `${pct0(r.now)} of ${r.nowN}`,
                  note: `${SUBJECT_SHORT[r.subjectId as SubjectId] ?? ""} · ${r.status}`,
                }))}
              />
            </ChartFrame>
          ) : weakTrend.rows.length ? (
            <EmptyState title={`${plural(weakTrend.nowCount, "weak topic")} now; no comparison yet`}>
              The comparison with {WEAK_WINDOW_DAYS} days ago needs answers from before {shortDate(weakTrend.cutoff)}. Until then, sort the topic table below by accuracy to see your current weak topics.
            </EmptyState>
          ) : (
            <EmptyState title="No weak topics">
              A topic counts as weak once you have given at least 3 answers in it with under 70% accuracy. None of your topics meets that today{weakTrend.hasHistory ? ` or did ${WEAK_WINDOW_DAYS} days ago` : ""}.
            </EmptyState>
          )}
        </div>
      </Section>

      <section aria-labelledby="topics-h">
        <h2 id="topics-h" className="mb-3 text-base font-semibold text-fg">
          Topic performance
        </h2>
        <TopicTable topics={model.topics} subjects={catalog.subjects.map((s) => ({ id: s.id, name: s.name }))} />
      </section>

      <MetricsExplainer />
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-3 text-base font-semibold text-fg">
        {title}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function MetricsExplainer() {
  return (
    <Card>
      <CardHeader title="How these numbers are computed" description="Learning analytics from your own attempts on this device. None of them is an official GATE metric." />
      <CardBody>
        <dl className="grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
          <div className="md:row-span-3">
            <dt className="font-medium text-fg">Your topic mastery (0–100)</dt>
            <dd className="mt-1 space-y-1 text-fg-2">
              <p>
                60% × recency-weighted accuracy (an answer&apos;s weight halves every {MASTERY_HALF_LIFE_DAYS} days)
                <br />+ 25% × PYQ coverage (share of the topic&apos;s official PYQs you have attempted; if the topic has no PYQs, this weight moves to accuracy)
                <br />+ 15% × revision health (share of the topic&apos;s revision items that are not overdue and were last graded &quot;almost&quot; or &quot;got it&quot;; with no revision items,
                this weight moves to accuracy).
              </p>
              <p>
                It needs at least {MASTERY_MIN_ATTEMPTS} answers in the topic; otherwise it shows &quot;Not enough data&quot;. Levels: Strong ≥ 85, Proficient ≥ 70, Developing ≥ 40, Needs work below
                40.
              </p>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Accuracy</dt>
              <dd className="mt-1 text-fg-2">Correct answers ÷ (correct + incorrect). Skipped mock questions and questions the official key awarded marks-to-all are left out.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Weak topic</dt>
            <dd className="mt-1 text-fg-2">
              At least 3 answers and under 70% accuracy, ranked by the lower bound of the 95% Wilson interval, so 1 of 5 correct ranks weaker than 0 of 1.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Mock score % and study streak</dt>
            <dd className="mt-1 text-fg-2">
              Mock score % is your score ÷ the mock&apos;s maximum marks, with GATE negative marking where the mock uses it. The streak counts consecutive days with at least one answer, ending today
              or yesterday.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-fg-3">
          These figures describe your practice on this platform only. They do not estimate a GATE score, percentile or rank.{" "}
          <Link href="/sources" className="font-medium text-accent-text hover:underline">
            Sources &amp; methodology
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
