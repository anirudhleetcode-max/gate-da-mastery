"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Lightbulb, RotateCcw, Settings2, Sigma, Target, XCircle } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import { QuestionSession } from "@/components/question/QuestionSession";
import { DifficultyBadge, OriginBadge, TypeBadge } from "@/components/question/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import { RichHtml } from "@/components/ui/RichHtml";
import { useAttempts, useRevisionItems, useSetting, useDbQuery, useUserData } from "@/lib/userdata/hooks";
import { localDay } from "@/lib/userdata/db";
import { useStorageValue } from "@/lib/useStorage";
import { DAILY_CONFIG_KEY, normalizeDailyConfig, type DailyConfig } from "@/lib/daily/config";
import { buildDailyPlan, dueAtStartOfDay, planSignature, stateAtStartOfDay, QUESTION_REASON_LABEL, DAILY_REVISION_MAX, type DailyPlan } from "@/lib/daily/plan";
import { poolQuestionLabel, type PoolQuestion } from "@/lib/practice/pool";
import { SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatDate, pct, plural } from "@/lib/utils";
import { PageSkeleton, StorageUnavailable } from "@/components/dashboard/parts";
import { dueLabel, useLoadStatus, useToday } from "@/components/dashboard/useStudentData";
import { CustomizeDialog } from "./CustomizeDialog";

export interface TodayConcept {
  id: string;
  title: string;
  subjectId: string;
  topicId: string;
}
export interface TodayFormula {
  id: string;
  name: string;
  subjectId: string;
  topicId: string;
  /** Rendered formula HTML (math placeholders, hydrated on the client). */
  html: string;
}
export interface TodayTaxonomy {
  subjects: { id: string; name: string }[];
  topics: { id: string; subjectId: string; name: string; pyqMarks: number }[];
}

/**
 * The plan is generated from the state at the start of the day, but the
 * revision queue can change during the day (a wrong answer queues or brings an
 * item forward). To keep the set identical all day, the first plan generated
 * for a day + settings is pinned in local storage.
 */
const PLAN_CACHE_KEY = "gate-da-daily-plan";
type PinnedPlan = Omit<DailyPlan, "revisionKeys"> & { signature: string };

/** Today's settings from the local user database (useSetting), plus whether they have loaded. */
function useDailyConfig(): { config: DailyConfig; loaded: boolean; save: (c: DailyConfig) => void } {
  const [raw, save] = useSetting<unknown>(DAILY_CONFIG_KEY, null);
  const exists = useDbQuery<boolean | null>(async (db) => (await db.settings.get(DAILY_CONFIG_KEY)) !== undefined, [], null);
  const config = useMemo(() => normalizeDailyConfig(raw), [raw]);
  return { config, loaded: exists === false || (exists === true && raw !== null), save };
}

export function TodayClient({ pool, concepts, formulas, taxonomy }: { pool: PoolQuestion[]; concepts: TodayConcept[]; formulas: TodayFormula[]; taxonomy: TodayTaxonomy }) {
  const attempts = useAttempts();
  const revision = useRevisionItems();
  const today = useToday();
  const { demo } = useUserData();
  const { status } = useLoadStatus({ attempts, revisionItems: revision });
  const { config, loaded: configLoaded, save } = useDailyConfig();
  const [cacheRaw, setCache] = useStorageValue(PLAN_CACHE_KEY, "local");
  const [session, setSession] = useState<{ ids: string[]; title: string; key: number } | null>(null);
  const [customizing, setCustomizing] = useState(false);

  const daSubjects = useMemo(() => taxonomy.subjects.filter((s) => s.id !== "ga"), [taxonomy]);
  const topicById = useMemo(() => new Map(taxonomy.topics.map((t) => [t.id, t])), [taxonomy]);
  const poolById = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool]);
  const start = useMemo(() => (today ? stateAtStartOfDay(attempts, today) : null), [attempts, today]);
  const dueToday = useMemo(() => (today ? dueAtStartOfDay(revision, today) : []), [revision, today]);
  const ready = status !== "loading" && configLoaded && today !== null && start !== null;
  // Attempts before today only change when data is imported or cleared; then the plan is rebuilt.
  const signature = today && start ? `${demo ? "demo" : "user"}:${start.count}:${planSignature(today, config)}` : "";

  const fresh = useMemo(() => {
    if (!ready || !today || !start) return null;
    return buildDailyPlan({
      day: today,
      pool,
      history: start.history,
      weakTopicIds: start.weakTopicIds,
      dueRevision: dueToday.map((r) => ({ key: r.key, nextReview: r.nextReview, topicId: r.topicId })),
      concepts,
      formulas,
      topicWeights: new Map(taxonomy.topics.map((t) => [t.id, t.pyqMarks])),
      topicOrder: new Map(taxonomy.topics.map((t, i) => [t.id, i])),
      config,
      daSubjectIds: daSubjects.map((s) => s.id),
    });
  }, [ready, today, start, pool, dueToday, concepts, formulas, taxonomy, config, daSubjects]);

  const pinned = useMemo(() => {
    try {
      const p = cacheRaw ? (JSON.parse(cacheRaw) as PinnedPlan) : null;
      return p && p.signature === signature ? p : null;
    } catch {
      return null;
    }
  }, [cacheRaw, signature]);

  // Pin the first plan of the day (for these settings) so it stays put while you work.
  useEffect(() => {
    if (!fresh || pinned || !signature) return;
    const { revisionKeys: _r, ...core } = fresh;
    void _r;
    setCache(JSON.stringify({ ...core, signature } satisfies PinnedPlan));
  }, [fresh, pinned, signature, setCache]);

  const plan = useMemo(() => {
    const base = pinned ?? fresh;
    if (!base) return null;
    const known = (id: string) => poolById.has(id);
    return {
      ...base,
      questionIds: base.questionIds.filter(known),
      weakExercise: base.weakExercise ? { ...base.weakExercise, questionIds: base.weakExercise.questionIds.filter(known) } : null,
    };
  }, [pinned, fresh, poolById]);

  const todays = useMemo(() => {
    const m = new Map<string, "correct" | "incorrect" | "other">();
    const rows = today ? attempts.filter((a) => a.day === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
    for (const a of rows) {
      if (a.status === "unanswered") continue;
      m.set(a.questionId, a.status === "correct" ? "correct" : a.status === "incorrect" ? "incorrect" : "other");
    }
    const scored = rows.filter((a) => a.status === "correct" || a.status === "incorrect");
    return { byQuestion: m, answers: scored.length, correct: scored.filter((a) => a.status === "correct").length };
  }, [attempts, today]);

  if (!ready || !plan || !today) return <PageSkeleton blocks={4} label="Preparing today's set…" />;

  // ------------------------------------------------------------------ running a session
  if (session) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSession(null)} className="-ml-2">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to today&apos;s plan
        </Button>
        <QuestionSession key={session.key} ids={session.ids} context="daily" title={session.title} />
      </div>
    );
  }

  const nothingSelected = config.subjects !== null && config.subjects.length === 0 && !config.includeGA;
  const done = plan.questionIds.filter((id) => todays.byQuestion.has(id));
  const remaining = plan.questionIds.filter((id) => !todays.byQuestion.has(id));
  const exercise = plan.weakExercise;
  const exerciseDone = exercise ? exercise.questionIds.filter((id) => todays.byQuestion.has(id)).length : 0;
  const revisionSet = dueToday.slice().sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.key.localeCompare(b.key)).slice(0, DAILY_REVISION_MAX);
  const reviewedToday = revisionSet.filter((r) => r.lastReviewed && localDay(new Date(r.lastReviewed)) === today);
  const dueNow = revision.filter((r) => r.nextReview <= today).length;
  const concept = plan.conceptId ? concepts.find((c) => c.id === plan.conceptId) : undefined;
  const planFormulas = plan.formulaIds.map((id) => formulas.find((f) => f.id === id)).filter((f): f is TodayFormula => Boolean(f));
  const weakSet = new Set(start!.weakTopicIds);
  const startSession = (ids: string[], title: string) => setSession({ ids, title, key: Date.now() });
  const subjectsLabel =
    config.subjects === null ? `all subjects${config.includeGA ? "" : " except General Aptitude"}` : `${plural(config.subjects.length + (config.includeGA ? 1 : 0), "subject")}`;

  return (
    <div className="space-y-6">
      {status === "unavailable" ? <StorageUnavailable /> : null}

      {/* ------------------------------------------------ status for today */}
      <section aria-labelledby="today-status" className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 shadow-[var(--shadow)] sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 id="today-status" className="text-sm font-semibold text-fg">
              {formatDate(today)}
            </h2>
            <p className="text-xs text-fg-3">
              {config.count} questions · {subjectsLabel}
            </p>
          </div>
          <div className="min-w-48 flex-1" role="status">
            <div className="mb-1 flex justify-between text-xs text-fg-2">
              <span>Today&apos;s questions</span>
              <span className="tnum">
                {done.length} of {plan.questionIds.length} done
              </span>
            </div>
            <ProgressBar value={done.length} max={Math.max(1, plan.questionIds.length)} label="Today's questions done" tone={done.length && done.length === plan.questionIds.length ? "success" : "accent"} />
          </div>
          <p className="tnum text-sm text-fg-2">
            {todays.answers ? (
              <>
                <span className="font-semibold text-fg">{plural(todays.answers, "answer")}</span> today · {pct(todays.correct / todays.answers, 0)} correct
              </>
            ) : (
              "No answers yet today"
            )}
          </p>
          <Button size="sm" onClick={() => setCustomizing(true)}>
            <Settings2 aria-hidden className="h-4 w-4" /> Customize
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* ------------------------------------------------ questions */}
          <Card>
            <CardHeader
              title="Today's questions"
              description="Official PYQs and original practice questions, mostly ones you have not attempted yet. Questions from mock tests are never used, so no mock is spoiled."
            />
            {nothingSelected ? (
              <CardBody>
                <EmptyState title="No subjects selected" action={<Button variant="primary" onClick={() => setCustomizing(true)}>Choose subjects</Button>}>
                  Pick at least one subject, or include General Aptitude, to get today&apos;s questions.
                </EmptyState>
              </CardBody>
            ) : plan.questionIds.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No questions available for your selection"
                  action={
                    <Button variant="primary" onClick={() => setCustomizing(true)}>
                      Include more subjects
                    </Button>
                  }
                >
                  {exercise?.questionIds.length
                    ? "Every available question in your selected subjects is already in today's weak-topic exercise. Include more subjects for a separate set."
                    : "The question bank has no questions in the subjects you selected yet. Include more subjects to get a set."}
                </EmptyState>
              </CardBody>
            ) : (
              <>
                {plan.questionIds.length < plan.requested ? (
                  <div className="px-4 pt-4 sm:px-5">
                    <Callout tone="info">
                      Only {plan.questionIds.length} of the {plan.requested} questions you asked for are available in your selected subjects today
                      {exercise?.questionIds.length ? " (the weak-topic exercise has its own questions)" : ""}.
                    </Callout>
                  </div>
                ) : null}
                <ol className="divide-y divide-border">
                  {plan.questionIds.map((id, i) => {
                    const q = poolById.get(id)!;
                    const st = todays.byQuestion.get(id);
                    const topic = topicById.get(q.topicId);
                    return (
                      <li key={id} className="flex gap-3 px-4 py-3 sm:px-5">
                        <StatusIcon status={st} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="tnum text-sm text-fg-3">{i + 1}.</span>
                            <Link href={`/questions/${id}`} className="text-sm font-medium text-fg hover:underline">
                              {q.origin === "OFFICIAL_PYQ" ? poolQuestionLabel(q) : `${poolQuestionLabel(q)}: ${topic?.name ?? q.topicId}`}
                            </Link>
                            <OriginBadge origin={q.origin} />
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: SUBJECT_COLOR[q.subjectId as SubjectId] }} />
                              {SUBJECT_SHORT[q.subjectId as SubjectId]} › {topic?.name ?? q.topicId}
                            </span>
                            <TypeBadge type={q.type} marks={q.marks} />
                            <DifficultyBadge difficulty={q.difficulty} estimated={q.origin === "OFFICIAL_PYQ"} />
                            {plan.reasons[id] && plan.reasons[id] !== "new" ? <Badge tone="outline">{QUESTION_REASON_LABEL[plan.reasons[id]]}</Badge> : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
                  {done.length === 0 ? (
                    <Button variant="primary" onClick={() => startSession(plan.questionIds, "Today's questions")}>
                      Start today&apos;s questions
                    </Button>
                  ) : remaining.length ? (
                    <>
                      <Button variant="primary" onClick={() => startSession(remaining, "Today's questions")}>
                        Continue ({remaining.length} left)
                      </Button>
                      <Button onClick={() => startSession(plan.questionIds, "Today's questions")}>Start from the first question</Button>
                    </>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 aria-hidden className="h-4 w-4" /> All of today&apos;s questions are done.
                      </p>
                      <Button className="sm:ml-auto" onClick={() => startSession(plan.questionIds, "Today's questions")}>
                        Go through them again
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* ------------------------------------------------ weak-topic exercise */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Target aria-hidden className="h-4 w-4 text-fg-3" /> Weak-topic exercise
                </span>
              }
              description={
                exercise
                  ? exercise.basis === "weakest"
                    ? "Five questions from your weakest topic (lowest accuracy, allowing for how many answers it is based on), easiest first."
                    : "You do not have a weak topic yet (it needs at least 3 answers under 70% accuracy). Suggested instead: a topic with high historical PYQ weight that you have practised little."
                  : undefined
              }
            />
            <CardBody>
              {exercise && exercise.questionIds.length ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">
                      <Link href={`/subjects/${topicById.get(exercise.topicId)?.subjectId}/topics/${exercise.topicId}`} className="hover:underline">
                        {topicById.get(exercise.topicId)?.name ?? exercise.topicId}
                      </Link>
                    </p>
                    <p className="text-sm text-fg-3">
                      {SUBJECT_SHORT[topicById.get(exercise.topicId)?.subjectId as SubjectId] ?? ""} · {plural(exercise.questionIds.length, "question")}
                      {exercise.questionIds.length < 5 ? " (all that are available in this topic)" : ""} · {exerciseDone} done today
                    </p>
                  </div>
                  <Button variant={done.length === plan.questionIds.length && plan.questionIds.length ? "primary" : "secondary"} onClick={() => startSession(exercise.questionIds, "Weak-topic exercise")}>
                    {exerciseDone ? "Do the exercise again" : "Start exercise"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-fg-3">No questions are available for a weak-topic exercise in your selected subjects.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* ------------------------------------------------ revision */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <RotateCcw aria-hidden className="h-4 w-4 text-fg-3" /> Revision set
                </span>
              }
              action={
                dueNow ? (
                  <ButtonLink href="/revision" size="sm" variant="primary">
                    Start revision
                  </ButtonLink>
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {revisionSet.length ? (
                <>
                  <p className="text-sm text-fg-2">
                    {dueNow ? (
                      <>
                        <span className="tnum font-semibold text-fg">{dueNow}</span> {dueNow === 1 ? "item is" : "items are"} due now
                        {dueNow > DAILY_REVISION_MAX ? `; today's set is the ${DAILY_REVISION_MAX} most overdue` : ""}.
                      </>
                    ) : (
                      "Everything due today has been reviewed."
                    )}{" "}
                    {reviewedToday.length ? `${reviewedToday.length} reviewed today.` : ""}
                  </p>
                  <ul className="space-y-1.5">
                    {revisionSet.map((r) => {
                      const reviewed = r.lastReviewed && localDay(new Date(r.lastReviewed)) === today;
                      const d = dueLabel(r.nextReview, today);
                      return (
                        <li key={r.key} className="flex items-center gap-2 text-sm">
                          {reviewed ? <CheckCircle2 role="img" aria-label="Reviewed today" className="h-4 w-4 shrink-0 text-success" /> : <Circle aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />}
                          <span className={cn("min-w-0 flex-1 truncate", reviewed ? "text-fg-3" : "text-fg-2")}>{r.title}</span>
                          {reviewed ? <Badge tone="success">Reviewed</Badge> : <Badge tone={d.tone}>{d.text}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-fg-3">
                  Nothing is due for revision today. Questions you answer incorrectly are queued automatically and come back after a day.
                </p>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ concept */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Lightbulb aria-hidden className="h-4 w-4 text-fg-3" /> Concept of the day
                </span>
              }
            />
            <CardBody>
              {concept ? (
                <div>
                  <Link href={`/concepts/${concept.id}`} className="font-medium text-accent-text hover:underline">
                    {concept.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-fg-3">
                    {SUBJECT_SHORT[concept.subjectId as SubjectId] ?? concept.subjectId} › {topicById.get(concept.topicId)?.name ?? concept.topicId}
                    {weakSet.has(concept.topicId) ? " · from one of your weak topics" : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-fg-3">
                  The concept library has no notes for your selected subjects in this build. Study a topic from{" "}
                  <Link href="/subjects" className="font-medium text-accent-text hover:underline">
                    Subjects
                  </Link>{" "}
                  meanwhile.
                </p>
              )}
            </CardBody>
          </Card>

        </div>
      </div>

      {/* ------------------------------------------------ formulas */}
      <section aria-labelledby="today-formulas">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="today-formulas" className="flex items-center gap-2 text-base font-semibold text-fg">
              <Sigma aria-hidden className="h-4 w-4 text-fg-3" /> Five formulas
            </h2>
            {planFormulas.length ? <p className="text-sm text-fg-3">Read each one, then say aloud when you would use it before opening its card.</p> : null}
          </div>
          {planFormulas.length ? (
            <Link href="/formulas" className="text-sm font-medium text-accent-text hover:underline">
              Formula book
            </Link>
          ) : null}
        </div>
        {planFormulas.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {planFormulas.map((f) => (
              <li key={f.id} className="min-w-0 rounded-[var(--radius)] border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link href={`/formulas/${f.subjectId}#${f.id}`} className="text-sm font-medium text-fg hover:underline">
                    {f.name}
                  </Link>
                  <span className="text-xs text-fg-3">{topicById.get(f.topicId)?.name ?? SUBJECT_SHORT[f.subjectId as SubjectId]}</span>
                </div>
                <div className="mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-1">
                  <RichHtml html={f.html} className="text-sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius)] border border-dashed border-border-strong bg-surface px-4 py-3 text-sm text-fg-3">The formula book has no cards for your selected subjects in this build.</p>
        )}
      </section>

      <CustomizeDialog open={customizing} onOpenChange={setCustomizing} config={config} onChange={save} subjects={daSubjects} />
    </div>
  );
}

function StatusIcon({ status }: { status: "correct" | "incorrect" | "other" | undefined }) {
  if (status === "correct") return <CheckCircle2 role="img" aria-label="Answered correctly today" className="mt-0.5 h-5 w-5 shrink-0 text-success" />;
  if (status === "incorrect") return <XCircle role="img" aria-label="Answered incorrectly today" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />;
  if (status === "other") return <CheckCircle2 role="img" aria-label="Attempted today" className="mt-0.5 h-5 w-5 shrink-0 text-fg-3" />;
  return <Circle role="img" aria-label="Not attempted today" className="mt-0.5 h-5 w-5 shrink-0 text-border-strong" />;
}
