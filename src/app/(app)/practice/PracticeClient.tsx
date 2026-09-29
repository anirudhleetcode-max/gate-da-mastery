"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Lock, Play } from "lucide-react";
import type { Difficulty } from "@/lib/content/schema";
import { QuestionSession } from "@/components/question/QuestionSession";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Segmented } from "@/components/ui/Segmented";
import { useAttempts, useMockAttempts } from "@/lib/userdata/hooks";
import { questionHistory, type PoolQuestion } from "@/lib/practice/pool";
import {
  PRACTICE_COUNTS,
  eligiblePool,
  matchPractice,
  resolveExplicitIds,
  selectPractice,
  timeLimitSec,
  type PracticeCount,
  type PracticeFilters,
  type PracticeSource,
  type PracticeStatus,
} from "@/lib/practice/select";
import { rngFrom, shuffle } from "@/lib/daily/random";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER } from "@/lib/labels";
import { cn, plural } from "@/lib/utils";
import { PageSkeleton, StorageUnavailable } from "@/components/dashboard/parts";
import { useLoadStatus } from "@/components/dashboard/useStudentData";

export type PracticeTaxonomy = { id: string; name: string; topics: { id: string; name: string }[] }[];

const SOURCE_OPTIONS: { value: PracticeSource; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "pyq", label: "Official PYQs" },
  { value: "original", label: "Original" },
];
const STATUS_OPTIONS: { value: PracticeStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unattempted", label: "Unattempted" },
  { value: "incorrect", label: "Previously incorrect" },
];

function countBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}

const minutes = (sec: number) => Math.ceil(sec / 60);

/** Phones: segments share the full width, are at least 40px tall and may wrap their text; from sm up: the usual compact control. */
const SEGMENTED_FULL = "flex w-full [&>button]:min-h-10 [&>button]:flex-1 [&>button]:leading-tight sm:inline-flex sm:w-auto sm:[&>button]:min-h-0 sm:[&>button]:flex-none";

export function PracticeClient({
  pool,
  taxonomy,
  initialFilters,
  initialIds,
  mockCount,
}: {
  pool: PoolQuestion[];
  taxonomy: PracticeTaxonomy;
  initialFilters: PracticeFilters;
  initialIds: string[] | null;
  mockCount: number;
}) {
  const attempts = useAttempts();
  const mockRows = useMockAttempts();
  const { status } = useLoadStatus({ attempts, mockAttempts: mockRows });
  const [f, setF] = useState<PracticeFilters>(initialFilters);
  const [session, setSession] = useState<{ ids: string[]; timeLimitSec?: number; key: number; title: string; shortfall: string | null } | null>(null);

  const history = useMemo(() => questionHistory(attempts), [attempts]);
  const submitted = useMemo(() => new Set(mockRows.filter((r) => r.status === "submitted").map((r) => r.testId)), [mockRows]);
  const eligible = useMemo(() => eligiblePool(pool, submitted), [pool, submitted]);
  const topicOrder = useMemo(() => new Map(taxonomy.flatMap((s) => s.topics).map((t, i) => [t.id, i])), [taxonomy]);
  const matched = useMemo(() => matchPractice(eligible, f, history, topicOrder), [eligible, f, history, topicOrder]);
  const subjectCounts = useMemo(() => countBy(matchPractice(eligible, { ...f, subjectId: "", topicId: "" }, history), (q) => q.subjectId), [eligible, f, history]);
  const topicCounts = useMemo(() => countBy(matchPractice(eligible, { ...f, topicId: "" }, history), (q) => q.topicId), [eligible, f, history]);
  const explicit = useMemo(() => (initialIds ? resolveExplicitIds(initialIds, pool, submitted) : null), [initialIds, pool, submitted]);

  if (status === "loading") return <PageSkeleton blocks={2} label="Loading your question history…" />;

  const set = (patch: Partial<PracticeFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const begin = (ids: string[], limit: number | null, title: string, shortfall: string | null) => {
    setSession({ ids, timeLimitSec: limit ?? undefined, key: Date.now(), title, shortfall });
    window.scrollTo({ top: 0 });
  };

  // ------------------------------------------------------------------ running
  if (session) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => {
            setSession(null);
            window.scrollTo({ top: 0 });
          }}
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to practice setup
        </Button>
        {session.shortfall ? <Callout tone="info">{session.shortfall}</Callout> : null}
        <QuestionSession key={session.key} ids={session.ids} context="practice" timeLimitSec={session.timeLimitSec} title={session.title} />
      </div>
    );
  }

  const byOrigin = countBy(eligible, (q) => q.origin);
  const lockedMockQuestions = pool.filter((q) => q.origin === "MOCK_TEST").length - (byOrigin.get("MOCK_TEST") ?? 0);
  const incorrectCount = eligible.filter((q) => history.get(q.id)?.lastScored === "incorrect").length;
  const answeredCount = eligible.filter((q) => (history.get(q.id)?.answered ?? 0) > 0).length;

  // ------------------------------------------------------------------ explicit ids (?ids=…)
  if (explicit) {
    const qs = explicit.questions;
    const est = timeLimitSec(qs);
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Practise a selected set" description="This link opened a specific list of questions." />
          <CardBody className="space-y-4">
            {status === "unavailable" ? <StorageUnavailable /> : null}
            <p className="text-sm text-fg-2" role="status">
              <span className="tnum text-2xl font-semibold text-fg">{qs.length}</span> {qs.length === 1 ? "question is" : "questions are"} ready
              {qs.length ? ` · about ${minutes(est)} min at the estimated pace` : ""}.
            </p>
            {explicit.locked.length ? (
              <Callout tone="info" title={`${plural(explicit.locked.length, "question")} left out`}>
                {explicit.locked.length === 1 ? "It belongs" : "They belong"} to a mock test you have not submitted yet. Mock questions unlock once you take that mock, so the test stays unseen.
              </Callout>
            ) : null}
            {explicit.unknown.length ? (
              <Callout tone="warning" title={`${plural(explicit.unknown.length, "question")} not found`}>
                {explicit.unknown.length === 1 ? "This id is" : "These ids are"} not in the question bank: {explicit.unknown.slice(0, 5).join(", ")}
                {explicit.unknown.length > 5 ? "…" : ""}
              </Callout>
            ) : null}
            <TimingAndOrder f={f} set={set} estimateSec={est} />
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                variant="primary"
                size="lg"
                disabled={!qs.length}
                onClick={() => {
                  const ordered = f.shuffle ? shuffle(qs, rngFrom(Date.now())) : qs;
                  begin(
                    ordered.map((q) => q.id),
                    f.timed ? timeLimitSec(ordered) : null,
                    "Selected practice set",
                    null,
                  );
                }}
              >
                <Play aria-hidden className="h-4 w-4" /> Start {plural(qs.length, "question")}
              </Button>
              <ButtonLink href="/practice" size="lg">
                Build my own set instead
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
        <PoolCard byOrigin={byOrigin} locked={lockedMockQuestions} submitted={submitted.size} mockCount={mockCount} answered={answeredCount} incorrect={incorrectCount} />
      </div>
    );
  }

  // ------------------------------------------------------------------ builder
  const subject = taxonomy.find((s) => s.id === f.subjectId);
  const setSize = Math.min(f.count, matched.length);
  const avgSec = matched.length ? matched.reduce((a, q) => a + q.estimatedTimeSec, 0) / matched.length : 0;
  const relax: { label: string; n: number; patch: Partial<PracticeFilters> }[] = [];
  if (matched.length < f.count) {
    const tryPatch = (label: string, patch: Partial<PracticeFilters>) => {
      const n = matchPractice(eligible, { ...f, ...patch }, history).length;
      if (n > matched.length) relax.push({ label, n, patch });
    };
    if (f.difficulties.length) tryPatch("Any difficulty", { difficulties: [] });
    if (f.status !== "all") tryPatch("Any status", { status: "all" });
    if (f.source !== "both") tryPatch("PYQs and original", { source: "both" });
    if (f.topicId) tryPatch(`All ${subject?.name ?? ""} topics`, { topicId: "" });
    else if (f.subjectId) tryPatch("All subjects", { subjectId: "" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        aria-labelledby="practice-form-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (!matched.length) return;
          const sel = selectPractice(eligible, f, history, Date.now() >>> 0, topicOrder);
          const shortfall = sel.ids.length < f.count ? `Only ${plural(sel.ids.length, "question")} matched your filters, so this set has ${sel.ids.length} instead of ${f.count}.` : null;
          begin(sel.ids, sel.timeLimitSec, "Practice set", shortfall);
        }}
      >
        <Card>
          <CardHeader title={<span id="practice-form-title">Build your set</span>} />
          <CardBody className="space-y-5">
            {status === "unavailable" ? <StorageUnavailable /> : null}
            <Field label="Number of questions">
              <Segmented
                label="Number of questions"
                value={String(f.count) as `${PracticeCount}`}
                onChange={(v) => set({ count: Number(v) as PracticeCount })}
                options={PRACTICE_COUNTS.map((n) => ({ value: String(n) as `${PracticeCount}`, label: String(n) }))}
                className={SEGMENTED_FULL}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="practice-subject"
                label="Subject"
                value={f.subjectId}
                onChange={(v) => set({ subjectId: v, topicId: "" })}
              >
                <option value="">All subjects ({[...subjectCounts.values()].reduce((a, b) => a + b, 0)})</option>
                {taxonomy.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({subjectCounts.get(s.id) ?? 0})
                  </option>
                ))}
              </SelectField>
              <SelectField id="practice-topic" label="Topic" value={f.topicId} onChange={(v) => set({ topicId: v })} disabled={!subject} hint={subject ? undefined : "Choose a subject first"}>
                {subject ? (
                  <>
                    <option value="">All topics ({subject.topics.reduce((a, t) => a + (topicCounts.get(t.id) ?? 0), 0)})</option>
                    {subject.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({topicCounts.get(t.id) ?? 0})
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">All topics</option>
                )}
              </SelectField>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">
                Difficulty <span className="font-normal text-fg-3">(any if none selected; PYQ difficulty is platform-estimated)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_ORDER.map((d: Difficulty) => {
                  const on = f.difficulties.includes(d);
                  return (
                    <label
                      key={d}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--focus)]"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={(e) => set({ difficulties: e.target.checked ? DIFFICULTY_ORDER.filter((x) => x === d || f.difficulties.includes(x)) : f.difficulties.filter((x) => x !== d) })}
                      />
                      {DIFFICULTY_LABEL[d]}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Field label="Source" hint="Both = official PYQs and original questions. Original questions are written for this platform and are not official GATE questions; they include questions from mock tests you have already submitted.">
              <Segmented label="Source" value={f.source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} className={SEGMENTED_FULL} />
            </Field>

            <Field label="Status" hint={f.status === "incorrect" ? "Questions whose latest answer was wrong." : f.status === "unattempted" ? "Questions you have never answered." : undefined}>
              <Segmented label="Status" value={f.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} className={SEGMENTED_FULL} />
            </Field>

            <TimingAndOrder f={f} set={set} estimateSec={avgSec * setSize} approximate />

            {/* ------------------------------------------------ summary + start */}
            <div className="space-y-3 border-t border-border pt-4">
              <div role="status" aria-live="polite" className="text-sm text-fg-2">
                {matched.length === 0 ? (
                  <p>
                    <span className="font-semibold text-fg">No questions match these filters.</span>{" "}
                    {relax.length ? "Loosen one of them:" : eligible.length ? "Try a different combination." : "The question bank is empty in this build."}
                  </p>
                ) : matched.length < f.count ? (
                  <p>
                    <span className="font-semibold text-fg">Only {plural(matched.length, "question")} match</span>, so your set will have {matched.length} instead of {f.count}.
                  </p>
                ) : (
                  <p>
                    <span className="tnum font-semibold text-fg">{matched.length}</span> questions match; {f.count} will be picked at random.
                  </p>
                )}
              </div>
              {relax.length ? (
                <div className="flex flex-wrap gap-2">
                  {relax.map((r) => (
                    <Button key={r.label} size="sm" className="max-sm:h-10" onClick={() => set(r.patch)}>
                      {r.label} ({r.n})
                    </Button>
                  ))}
                </div>
              ) : null}
              <Button type="submit" variant="primary" size="lg" disabled={!matched.length} className="w-full sm:w-auto">
                <Play aria-hidden className="h-4 w-4" /> Start {setSize ? plural(setSize, "question") : "practice"}
                {f.timed && setSize ? ` · about ${minutes(avgSec * setSize)} min` : ""}
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>

      <div className="space-y-4">
        <PoolCard byOrigin={byOrigin} locked={lockedMockQuestions} submitted={submitted.size} mockCount={mockCount} answered={answeredCount} incorrect={incorrectCount} />
        <Card>
          <CardHeader title="Quick sets" description="Each one fills in the form; check it and press Start." />
          <CardBody className="space-y-2">
            <QuickSet
              disabled={!incorrectCount}
              onClick={() => set({ status: "incorrect", subjectId: "", topicId: "", difficulties: [], source: "both" })}
              title="Retry what you got wrong"
              body={incorrectCount ? `${plural(incorrectCount, "question")} whose latest answer was wrong` : "Nothing to retry yet"}
            />
            <QuickSet onClick={() => set({ status: "unattempted", source: "pyq", subjectId: "", topicId: "", difficulties: [] })} title="Fresh official PYQs" body="Official questions you have never answered" />
            <QuickSet onClick={() => set({ count: 30, timed: true, status: "all", source: "both", subjectId: "", topicId: "", difficulties: [], shuffle: true })} title="Timed mixed drill" body="30 questions across all subjects, against the clock" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p aria-hidden className="mb-1.5 text-sm font-medium text-fg">
        {label}
      </p>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-fg-3">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-3"
      >
        {children}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TimingAndOrder({ f, set, estimateSec, approximate = false }: { f: PracticeFilters; set: (p: Partial<PracticeFilters>) => void; estimateSec: number; approximate?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Timing"
        hint={
          f.timed
            ? estimateSec > 0
              ? `${approximate ? "About " : ""}${minutes(estimateSec)} min: the sum of each question's estimated time, rounded up. The set ends when time runs out.`
              : "The time limit is the sum of each question's estimated time, rounded up."
            : "No time limit; the time you take is still recorded."
        }
      >
        <Segmented
          label="Timing"
          value={f.timed ? "timed" : "untimed"}
          onChange={(v) => set({ timed: v === "timed" })}
          options={[
            { value: "untimed", label: "Untimed" },
            { value: "timed", label: "Timed" },
          ]}
          className={SEGMENTED_FULL}
        />
      </Field>
      <div>
        <p aria-hidden className="mb-1.5 text-sm font-medium text-fg">
          Order
        </p>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-fg-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.shuffle} onChange={(e) => set({ shuffle: e.target.checked })} />
          Shuffle the questions
        </label>
        <p className="mt-0.5 text-xs text-fg-3">{f.shuffle ? "Mixed order, like the exam." : "Grouped by subject and topic, newest PYQs first."}</p>
      </div>
    </div>
  );
}

function PoolCard({ byOrigin, locked, submitted, mockCount, answered, incorrect }: { byOrigin: Map<string, number>; locked: number; submitted: number; mockCount: number; answered: number; incorrect: number }) {
  const rows: { label: string; n: number; dot: string }[] = [
    { label: "Official GATE PYQs", n: byOrigin.get("OFFICIAL_PYQ") ?? 0, dot: "var(--success)" },
    { label: "Original practice", n: byOrigin.get("ORIGINAL_PRACTICE") ?? 0, dot: "var(--accent)" },
    { label: "From mocks you submitted", n: byOrigin.get("MOCK_TEST") ?? 0, dot: "var(--violet)" },
  ];
  return (
    <Card>
      <CardHeader title="Your question pool" />
      <CardBody className="space-y-3 text-sm">
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.dot }} />
              <span className="flex-1 text-fg-2">{r.label}</span>
              <span className="tnum font-medium text-fg">{r.n}</span>
            </li>
          ))}
        </ul>
        <p className="flex gap-2 text-xs text-fg-3">
          <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {locked
              ? `${plural(locked, "mock question")} stay${locked === 1 ? "s" : ""} locked until you submit ${locked === 1 ? "its" : "their"} mock (${submitted} of ${mockCount} submitted), so no mock is spoiled.`
              : submitted
                ? "Questions of every mock you have submitted are included."
                : "Mock questions unlock after you submit that mock, so no mock is spoiled."}
          </span>
        </p>
        <p className="border-t border-border pt-3 text-xs text-fg-3">
          {answered ? (
            <>
              You have answered <span className="tnum font-medium text-fg-2">{answered}</span> of these; <span className="tnum font-medium text-fg-2">{incorrect}</span> were wrong on your latest try.
            </>
          ) : (
            <>
              You have not answered any of these yet. New to the platform? <Link href="/today" className="font-medium text-accent-text hover:underline">Today&apos;s set</Link> picks a balanced
              mix for you.
            </>
          )}
        </p>
      </CardBody>
    </Card>
  );
}

function QuickSet({ title, body, onClick, disabled }: { title: string; body: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("block w-full rounded-lg border border-border px-3 py-2.5 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60")}
    >
      <span className="block text-sm font-medium text-fg">{title}</span>
      <span className="block text-xs text-fg-3">{body}</span>
    </button>
  );
}
