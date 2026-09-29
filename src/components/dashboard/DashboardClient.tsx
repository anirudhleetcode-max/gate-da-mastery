"use client";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowRight, CalendarCheck, Dumbbell, FileQuestion, ListTree, Map as MapIcon, PlayCircle, RotateCcw, Timer } from "lucide-react";
import type { Catalog } from "@/lib/server/repo";
import type { SubjectId } from "@/lib/content/schema";
import { useProgressModel, type ProgressModel } from "@/lib/analytics/useProgress";
import { useMockAttempts, useRevisionItems } from "@/lib/userdata/hooks";
import type { RevisionItemRow } from "@/lib/userdata/db";
import { SUBJECT_ABBR, SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatClock, pct, plural } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { BarList, ChartFrame } from "@/components/charts/Charts";
import { mockProgress, type MockInfo, type MockProgress } from "./mocks";
import { MockScoreChart, PageSkeleton, StorageUnavailable, pct0 } from "./parts";
import { dayToDate, dueLabel, useLoadStatus, useToday } from "./useStudentData";

export interface ExamContext {
  institute: string | null;
  /** e.g. "February 6, 7, 13, 14, 20 and 21, 2027" (provisional). */
  dates: string | null;
  /** First provisional exam day "YYYY-MM-DD". */
  firstDate: string | null;
  datesNote: string | null;
}

export interface LibraryCounts {
  papers: number;
  years: string;
  officialQuestions: number;
  concepts: number;
  formulas: number;
  roadmapStages: number;
}

export function DashboardClient({ catalog, mocks, exam, library }: { catalog: Catalog; mocks: MockInfo[]; exam: ExamContext; library: LibraryCounts }) {
  const model = useProgressModel(catalog);
  const mockRows = useMockAttempts();
  const revision = useRevisionItems();
  const today = useToday();
  const { status } = useLoadStatus({ attempts: model.attempts, mockAttempts: mockRows, revisionItems: revision });
  const mp = useMemo(() => mockProgress(mocks, mockRows), [mocks, mockRows]);

  if (status === "loading" || !today) return <PageSkeleton />;
  const firstRun = model.attempts.length === 0 && mockRows.length === 0 && revision.length === 0;

  return (
    <div className="space-y-6">
      {status === "unavailable" ? <StorageUnavailable /> : null}
      <ExamCountdown exam={exam} today={today} />
      {firstRun ? (
        <FirstRun catalog={catalog} mocks={mocks} mp={mp} library={library} />
      ) : (
        <>
          <QuickActions mp={mp} dueToday={model.revisionDueToday} />
          <OverallStats model={model} mp={mp} />
          <div className="grid gap-4 lg:grid-cols-3">
            <SubjectProgress model={model} catalog={catalog} className="lg:col-span-2" />
            <div className="space-y-4">
              <WeakAreas model={model} />
              <UpcomingRevision items={revision} today={today} />
            </div>
          </div>
          <section aria-labelledby="dash-charts" className="grid gap-4 lg:grid-cols-2">
            <h2 id="dash-charts" className="sr-only">
              Mock performance and PYQ completion
            </h2>
            <MockScoreChart series={mp.series} title="Mock performance" />
            <PyqCompletion model={model} />
          </section>
          <p className="text-xs text-fg-3">
            All figures are computed on this device from your own attempts. They are learning analytics, not official GATE metrics, and they do not predict a GATE score or rank.{" "}
            <Link href="/progress" className="font-medium text-accent-text hover:underline">
              Detailed progress analytics
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ exam countdown

function ExamCountdown({ exam, today }: { exam: ExamContext; today: string }) {
  if (!exam.firstDate) return null;
  const days = Math.round((dayToDate(exam.firstDate).getTime() - dayToDate(today).getTime()) / 86_400_000);
  if (days < 0) return null;
  return (
    <p className="-mt-3 text-sm text-fg-2">
      <span className="tnum font-semibold text-fg">{plural(days, "day")}</span> until the first provisional GATE 2027 exam day. {exam.datesNote ?? "Check the official GATE 2027 website for the final schedule."}
    </p>
  );
}

// ------------------------------------------------------------------ first run

function FirstRun({ catalog, mocks, mp, library }: { catalog: Catalog; mocks: MockInfo[]; mp: MockProgress; library: LibraryCounts }) {
  const available = mocks.filter((m) => m.available).length;
  const first = mp.next;
  const steps: { href: string; icon: typeof ListTree; title: string; body: ReactNode; cta: string }[] = [
    {
      href: "/syllabus",
      icon: ListTree,
      title: "Read the official syllabus",
      body: `See every topic of the GATE DA syllabus across ${catalog.subjects.length} subjects (including General Aptitude) and how this platform groups them into ${catalog.topics.length} topics.`,
      cta: "Open the syllabus",
    },
    {
      href: "/roadmap",
      icon: MapIcon,
      title: "Plan with the roadmap",
      body: library.roadmapStages
        ? `Work through ${plural(library.roadmapStages, "stage")}, from foundations to full-length mocks, and tick each one off as you finish it.`
        : "Plan your preparation stage by stage, from foundations to full-length mocks.",
      cta: "Open the roadmap",
    },
    {
      href: "/pyqs",
      icon: FileQuestion,
      title: "Solve official PYQs",
      body: catalog.totals.pyqs
        ? `${catalog.totals.pyqs} official questions from ${plural(library.papers, "GATE DA paper")}${library.years ? ` (${library.years})` : ""}, each with a worked solution. Start with one subject you have just studied.`
        : "Official GATE DA questions with worked solutions, grouped by subject and paper.",
      cta: "Browse PYQs",
    },
    {
      href: first ? `/mocks/${first.id}` : "/mocks",
      icon: Timer,
      title: "Take mock tests",
      body: first
        ? `${available} of ${mocks.length} mocks are available. Begin with Mock ${first.number} (${first.shortTitle}, ${first.durationMinutes} min) in the GATE-style exam interface.`
        : "Timed tests in a GATE-style exam interface, from short foundations to full 3-hour simulations.",
      cta: first ? `Start Mock ${first.number}` : "See the mock tests",
    },
  ];
  return (
    <section aria-labelledby="first-run" className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title={<span id="first-run">Start here</span>}
          description="You have not recorded any attempts yet, so there are no statistics to show. A good order to begin in:"
        />
        <CardBody>
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.href} className="flex gap-3 rounded-lg border border-border p-3">
                  <span aria-hidden className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-text">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 font-medium text-fg">
                      <Icon aria-hidden className="h-4 w-4 text-fg-3" /> {s.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-fg-2">{s.body}</p>
                    <Link href={s.href} className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                      {s.cta} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Or jump straight in" />
          <CardBody className="space-y-2">
            <ButtonLink href="/today" variant="primary" className="w-full justify-start">
              <CalendarCheck aria-hidden className="h-4 w-4" /> Today&apos;s GATE DA
            </ButtonLink>
            <ButtonLink href="/practice" className="w-full justify-start">
              <Dumbbell aria-hidden className="h-4 w-4" /> Practice now
            </ButtonLink>
            <p className="pt-1 text-xs text-fg-3">Today&apos;s set picks 10 questions, a concept and 5 formulas for you; Practice now lets you build your own set.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="What is in the library" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <LibraryFact label="Official PYQs" value={catalog.totals.pyqs} hint={library.officialQuestions > catalog.totals.pyqs ? `of ${library.officialQuestions} in ${plural(library.papers, "paper")}` : undefined} />
              <LibraryFact label="Mocks available" value={available} hint={`of ${mocks.length}`} />
              <LibraryFact label="Practice questions" value={catalog.totals.practice} />
              <LibraryFact label="Formula cards" value={library.formulas} />
            </dl>
            <p className="mt-3 text-xs text-fg-3">Your progress is stored only in this browser. Export a backup from Settings now and then.</p>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function LibraryFact({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className="tnum text-lg font-semibold text-fg">
        {value} {hint ? <span className="text-xs font-normal text-fg-3">{hint}</span> : null}
      </dd>
    </div>
  );
}

// ------------------------------------------------------------------ quick actions

function QuickActions({ mp, dueToday }: { mp: MockProgress; dueToday: number }) {
  const items: { href: string; icon: typeof Timer; title: string; body: string; emphasis?: boolean }[] = [];
  if (mp.inProgress) {
    items.push({
      href: `/mocks/${mp.inProgress.id}/exam`,
      icon: PlayCircle,
      title: `Continue Mock ${mp.inProgress.number}`,
      body: `${formatClock(mp.inProgress.remainingMs)} left · timer paused`,
      emphasis: true,
    });
  }
  items.push({ href: "/today", icon: CalendarCheck, title: "Today's set", body: "Questions, a concept and formulas picked for today" });
  items.push({ href: "/practice", icon: Dumbbell, title: "Practice now", body: "Build a set by subject, topic and difficulty" });
  if (mp.next) items.push({ href: `/mocks/${mp.next.id}`, icon: Timer, title: `Next: Mock ${mp.next.number}`, body: `${mp.next.shortTitle} · ${mp.next.durationMinutes} min` });
  else items.push({ href: "/mocks", icon: Timer, title: "Mock tests", body: mp.taken ? "You have taken every available mock" : "See all mock tests" });
  if (!mp.inProgress) items.push({ href: "/revision", icon: RotateCcw, title: "Revision", body: dueToday ? `${plural(dueToday, "item")} due today` : "Nothing due today" });

  return (
    <nav aria-label="Quick actions">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex h-full min-h-16 items-center gap-3 rounded-[var(--radius)] border bg-surface px-4 py-3 transition-colors hover:bg-surface-2",
                  it.emphasis ? "border-warning/50 bg-warning-soft hover:bg-warning-soft" : "border-border hover:border-border-strong",
                )}
              >
                <span aria-hidden className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", it.emphasis ? "bg-surface text-warning" : "bg-accent-soft text-accent-text")}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{it.title}</span>
                  <span className="block truncate text-xs text-fg-3">{it.body}</span>
                </span>
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ------------------------------------------------------------------ overall

function OverallStats({ model, mp }: { model: ProgressModel; mp: MockProgress }) {
  const o = model.overall;
  return (
    <section aria-labelledby="overall">
      <h2 id="overall" className="mb-3 text-base font-semibold text-fg">
        Overall progress
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Questions solved" value={o.questionsSolved} hint="distinct questions answered" />
        <Stat label="PYQs completed" value={<>{o.pyqDone}<span className="text-base font-normal text-fg-3"> / {o.pyqTotal}</span></>} hint={o.pyqTotal ? `${pct(o.pyqDone / o.pyqTotal)} of loaded PYQs` : "no PYQs loaded"} />
        <Stat label="Mocks completed" value={<>{mp.taken}<span className="text-base font-normal text-fg-3"> / {mp.totalMocks}</span></>} hint={mp.submittedAttempts ? plural(mp.submittedAttempts, "submitted attempt") : "none submitted yet"} />
        <Stat label="Accuracy" value={pct(o.accuracy)} hint={o.attempted ? `${o.correct} of ${o.attempted} correct` : "no answers yet"} />
        <Stat label="Avg mock score" value={mp.avgRatio === null ? "—" : pct(mp.avgRatio)} hint={mp.avgRatio === null ? "submit a mock to see this" : "of max marks, all attempts"} />
        <Stat label="Study streak" value={plural(o.streak, "day")} hint={`${plural(o.studyDays, "study day")} in total`} />
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ subjects

function SubjectProgress({ model, catalog, className }: { model: ProgressModel; catalog: Catalog; className?: string }) {
  const bySubject = new Map(model.subjects.map((s) => [s.subjectId, s]));
  return (
    <Card className={className}>
      <CardHeader title="Subject progress" description="Bars show official PYQs attempted; accuracy counts every answer you submitted in the subject." action={<Link href="/progress" className="text-sm font-medium text-accent-text hover:underline">Details</Link>} />
      <ul className="divide-y divide-border">
        {catalog.subjects.map((cs) => {
          const s = bySubject.get(cs.id);
          if (!s) return null;
          const sid = cs.id as SubjectId;
          return (
            <li key={cs.id} className="grid grid-cols-1 gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_1fr_7.5rem] sm:items-center sm:px-5">
              <Link href={`/subjects/${cs.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg hover:underline">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[sid] }} />
                <span className="truncate">{cs.name}</span>
              </Link>
              <div className="flex items-center gap-2">
                {s.pyqTotal ? (
                  <>
                    <ProgressBar value={s.pyqDone} max={s.pyqTotal} label={`${cs.name}: PYQs attempted`} className="flex-1" />
                    <span className="tnum w-16 shrink-0 text-right text-xs text-fg-3">
                      {s.pyqDone}/{s.pyqTotal} PYQs
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-fg-3">No PYQs loaded for this subject</span>
                )}
              </div>
              <div className="tnum text-sm sm:text-right">
                <span className="font-semibold text-fg">{pct(s.accuracy, 0)}</span>{" "}
                <span className="text-xs text-fg-3">{s.attempted ? `of ${s.attempted}` : "no answers"}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------ weak areas

function WeakAreas({ model }: { model: ProgressModel }) {
  return (
    <Card>
      <CardHeader title="Weak areas" description="At least 3 answers and under 70% accuracy, weakest first." />
      <CardBody className={model.weak.length ? "px-0 py-0 sm:px-0" : undefined}>
        {model.weak.length ? (
          <ul className="divide-y divide-border">
            {model.weak.map((w) => (
              <li key={w.topicId} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/subjects/${w.subjectId}/topics/${w.topicId}`} className="block truncate text-sm font-medium text-fg hover:underline">
                    {w.name}
                  </Link>
                  <p className="tnum text-xs text-fg-3">
                    {SUBJECT_ABBR[w.subjectId as SubjectId] ?? w.subjectId} · {w.correct} of {w.attempted} correct ({pct0(w.accuracy)})
                  </p>
                </div>
                <ButtonLink href={`/practice?topic=${encodeURIComponent(w.topicId)}&count=10`} size="sm" aria-label={`Practise ${w.name}`}>
                  Practise
                </ButtonLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">
            No weak topic so far. A topic appears here once you have answered at least 3 of its questions with under 70% accuracy, so keep practising across subjects.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ revision

function UpcomingRevision({ items, today }: { items: RevisionItemRow[]; today: string }) {
  const due = items.filter((r) => r.nextReview <= today).length;
  const next = items.slice(0, 5);
  return (
    <Card>
      <CardHeader
        title="Upcoming revision"
        action={
          items.length ? (
            <ButtonLink href="/revision" size="sm" variant={due ? "primary" : "secondary"}>
              {due ? "Start revision" : "Open"}
            </ButtonLink>
          ) : undefined
        }
      />
      <CardBody className="space-y-3">
        {items.length ? (
          <>
            <p className="text-sm text-fg-2">
              <span className="tnum text-2xl font-semibold text-fg">{due}</span> {due === 1 ? "item" : "items"} due today
              <span className="text-fg-3"> · {items.length} in your queue</span>
            </p>
            <ul className="space-y-1.5">
              {next.map((r) => {
                const d = dueLabel(r.nextReview, today);
                return (
                  <li key={r.key} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-fg-2">{r.title}</span>
                    <Badge tone={d.tone}>{d.text}</Badge>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-fg-3">
            Your revision queue is empty. Questions you answer incorrectly are added automatically, and you can add any question, concept or formula yourself.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ PYQ completion

function PyqCompletion({ model }: { model: ProgressModel }) {
  const rows = model.subjects.filter((s) => s.pyqTotal > 0);
  if (!rows.length) return null;
  return (
    <ChartFrame
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
