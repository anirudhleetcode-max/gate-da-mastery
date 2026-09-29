"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { Catalog } from "@/lib/server/repo";
import type { AttemptRow, RevisionItemRow } from "@/lib/userdata/db";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { accuracyStat, topicMastery, type AccuracyStat, type Mastery } from "@/lib/analytics/stats";
import { useRevisionItems } from "@/lib/userdata/hooks";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, pct, plural } from "@/lib/utils";
import { MasteryBadge, OfficialSyllabusText, SubjectDot } from "./bits";
import { useDataStatus, useToday, type DataStatus } from "./hooks";
import type { SyllabusData, SyllabusSubject } from "./types";

interface RowProgress {
  acc: AccuracyStat;
  pyqDone: number;
  mastery: Mastery;
  revisionDue: number;
  revisionItems: number;
}

/**
 * Row grid: toggle · name · PYQs · practice · completion · accuracy · mastery · revision.
 * Laid out by the width of the subject card (container queries), not the viewport, so the
 * name column never gets squeezed next to the sidebar: a table from 56rem, a labelled
 * metrics row from 42rem, and a compact 4-column block below that.
 */
const ROW_GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2 @4xl:grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_4.25rem_5.25rem_5rem_8.5rem_5.5rem]";
const METRICS = "col-start-2 mt-1.5 grid grid-cols-4 gap-x-2 gap-y-1.5 @2xl:grid-cols-[repeat(4,minmax(0,1fr))_8.5rem_minmax(0,1fr)] @4xl:contents";

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <span className="block truncate text-[0.7rem] font-medium text-fg-3 @4xl:sr-only">{label}</span>
      <span className="block">{children}</span>
    </div>
  );
}

function Metrics({ pyqs, pyqHref, practice, p, status }: { pyqs: number; pyqHref?: string; practice: number; p?: RowProgress; status: DataStatus }) {
  // pyqHref only for topics: the PYQ browser filters by the question's topic, so a syllabus-phrase
  // count (which includes questions filed under other topics) would not match the list it opened.
  const ready = status === "ready" && p;
  const dash = <span className="text-fg-3">—</span>;
  return (
    <div className={METRICS}>
      <Cell label="PYQs">
        {pyqs && pyqHref ? (
          <Link href={pyqHref} className="tnum font-medium text-accent-text hover:underline" title="Open these PYQs in the PYQ browser">
            {pyqs}
          </Link>
        ) : (
          <span className={cn("tnum", pyqs ? "text-fg" : "text-fg-3")}>{pyqs}</span>
        )}
      </Cell>
      <Cell label="Practice">
        <span className={cn("tnum", practice ? "text-fg" : "text-fg-3")}>{practice}</span>
      </Cell>
      <Cell label="Completion">
        {ready && pyqs ? (
          <span className="tnum text-fg" title="Official PYQs you have attempted">
            {p.pyqDone}/{pyqs}
          </span>
        ) : (
          dash
        )}
      </Cell>
      <Cell label="Accuracy">
        {ready && p.acc.attempted ? (
          <span className="tnum text-fg" title={`${p.acc.correct} of ${p.acc.attempted} answered correctly`}>
            {pct(p.acc.accuracy, 0)}
            <span className="text-xs text-fg-3">
              {" "}
              {p.acc.correct}/{p.acc.attempted}
            </span>
          </span>
        ) : (
          dash
        )}
      </Cell>
      <Cell label="Your topic mastery" className="col-span-3 @2xl:col-span-1">
        {ready ? <MasteryBadge mastery={p.mastery} /> : dash}
      </Cell>
      <Cell label="Revision">
        {ready && p.revisionItems ? p.revisionDue ? <Badge tone="warning">{p.revisionDue} due</Badge> : <span className="text-xs text-fg-2">{p.revisionItems} later</span> : dash}
      </Cell>
    </div>
  );
}

function Toggle({ open, onClick, controls, label }: { open: boolean; onClick: () => void; controls: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
    >
      <ChevronRight aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
    </button>
  );
}

export function SyllabusTree({ data, catalog }: { data: SyllabusData; catalog: Catalog }) {
  const model = useProgressModel(catalog);
  const status = useDataStatus();
  const today = useToday();
  const revision = useRevisionItems();
  const allSubjects = useMemo(() => data.subjects.map((s) => s.id as string), [data.subjects]);
  const allTopics = useMemo(() => data.subjects.flatMap((s) => s.topics.map((t) => t.id)), [data.subjects]);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(() => new Set(allSubjects));
  const [openTopics, setOpenTopics] = useState<Set<string>>(() => new Set());

  const topicProgress = useMemo<Map<string, RowProgress>>(
    () =>
      new Map(
        model.topics.map((t) => [
          t.topicId,
          {
            acc: t,
            pyqDone: t.pyqDone,
            mastery: t.mastery,
            revisionDue: t.revisionDue,
            revisionItems: t.revisionItems,
          },
        ]),
      ),
    [model.topics],
  );

  // Subtopic figures use the same definitions as topics, over the questions tagged with each syllabus phrase.
  const subtopicProgress = useMemo<Map<string, RowProgress>>(() => {
    const out = new Map<string, RowProgress>();
    if (!today) return out;
    const now = new Date(`${today}T12:00:00`);
    const pyqTotal = new Map(data.subjects.flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((x) => [x.id, x.pyqCount] as const))));
    const attempts = new Map<number, AttemptRow[]>();
    const done = new Map<number, Set<string>>();
    for (const a of model.attempts) {
      // Same rules as the topic rows (useProgressModel): "done" = an answer was submitted, including
      // marks-to-all questions; accuracy and mastery count only scored answers.
      const submitted = a.status === "correct" || a.status === "incorrect" || a.status === "not_scored";
      for (const i of data.questionSubtopics[a.questionId] ?? []) {
        if (a.status !== "not_scored") (attempts.get(i) ?? attempts.set(i, []).get(i)!).push(a);
        if (a.origin === "OFFICIAL_PYQ" && submitted) (done.get(i) ?? done.set(i, new Set()).get(i)!).add(a.questionId);
      }
    }
    const rev = new Map<number, RevisionItemRow[]>();
    for (const r of revision) {
      if (r.kind !== "question") continue;
      for (const i of data.questionSubtopics[r.refId] ?? []) (rev.get(i) ?? rev.set(i, []).get(i)!).push(r);
    }
    data.subtopicIds.forEach((id, i) => {
      const rows = attempts.get(i) ?? [];
      const items = rev.get(i) ?? [];
      out.set(id, {
        acc: accuracyStat(rows),
        pyqDone: done.get(i)?.size ?? 0,
        mastery: topicMastery({
          attempts: rows,
          pyqTotal: pyqTotal.get(id) ?? 0,
          revisionItems: items,
          now,
        }),
        revisionDue: items.filter((r) => r.nextReview <= today).length,
        revisionItems: items.length,
      });
    });
    return out;
  }, [data, model.attempts, revision, today]);

  const subjectProgress = new Map(model.subjects.map((s) => [s.subjectId, s]));
  const everythingOpen = openSubjects.size === allSubjects.length && openTopics.size === allTopics.length;
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-10"
            onClick={() => {
              setOpenSubjects(new Set(allSubjects));
              setOpenTopics(new Set(allTopics));
            }}
            disabled={everythingOpen}
          >
            <ChevronsUpDown aria-hidden className="h-4 w-4" /> Expand all
          </Button>
          <Button
            size="sm"
            className="h-10"
            onClick={() => {
              setOpenSubjects(new Set());
              setOpenTopics(new Set());
            }}
            disabled={openSubjects.size === 0}
          >
            <ChevronsDownUp aria-hidden className="h-4 w-4" /> Collapse all
          </Button>
        </div>
        <p role="status" className="text-sm text-fg-3">
          {status === "loading"
            ? "Loading your progress…"
            : status === "unavailable"
              ? "Your progress cannot be read in this browser window (storage is blocked)."
              : model.overall.attempted
                ? `Your figures come from ${plural(model.overall.attempted, "answer")} saved on this device.`
                : "No answers saved on this device yet, so your columns show “—”."}
        </p>
      </div>

      <details className="rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm">
        <summary className="cursor-pointer py-1 font-medium text-fg">What the columns mean</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 pb-2 text-fg-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-fg">PYQs</dt>
            <dd>
              Official GATE DA questions filed under the topic (open the number to see them in the PYQ browser). For a syllabus phrase: every official question tagged with it, including questions
              filed under another topic.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Practice</dt>
            <dd>Original practice questions written for this platform.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Completion</dt>
            <dd>Official PYQs you have attempted, out of those tagged.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Accuracy</dt>
            <dd>Correct answers out of answered questions (PYQ, practice and mock), on this device.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Your topic mastery</dt>
            <dd>
              A platform score (not an official GATE metric) from recent accuracy, PYQ coverage and revision health; it needs at least 3 answers. The same formula is applied to each syllabus phrase.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Revision</dt>
            <dd>Items in your revision queue: how many are due now, or scheduled for later.</dd>
          </div>
        </dl>
      </details>

      {data.subjects.map((s) => (
        <SubjectSection
          key={s.id}
          s={s}
          open={openSubjects.has(s.id)}
          onToggle={() => setOpenSubjects((o) => toggle(o, s.id))}
          openTopics={openTopics}
          onToggleTopic={(id) => setOpenTopics((o) => toggle(o, id))}
          subject={subjectProgress.get(s.id)}
          topicProgress={topicProgress}
          subtopicProgress={subtopicProgress}
          status={status}
        />
      ))}
    </div>
  );
}

function SubjectSection({
  s,
  open,
  onToggle,
  openTopics,
  onToggleTopic,
  subject,
  topicProgress,
  subtopicProgress,
  status,
}: {
  s: SyllabusSubject;
  open: boolean;
  onToggle: () => void;
  openTopics: Set<string>;
  onToggleTopic: (id: string) => void;
  subject?: AccuracyStat & { pyqDone: number; pyqTotal: number };
  topicProgress: Map<string, RowProgress>;
  subtopicProgress: Map<string, RowProgress>;
  status: DataStatus;
}) {
  const bodyId = `syl-body-${s.id}`;
  const phrases = s.topics.reduce((a, t) => a + t.subtopics.length, 0);
  const revisionDue = s.topics.reduce((a, t) => a + (topicProgress.get(t.id)?.revisionDue ?? 0), 0);
  const ready = status === "ready" && subject;
  return (
    <section id={s.id} aria-labelledby={`syl-h-${s.id}`} className="scroll-mt-20 overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
      <div className="flex flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
        <h2 id={`syl-h-${s.id}`} className="min-w-0 flex-1">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId} className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-surface-2">
            <ChevronRight aria-hidden className={cn("h-4 w-4 shrink-0 text-fg-3 transition-transform", open && "rotate-90")} />
            <SubjectDot id={s.id} />
            <span className="min-w-0">
              <span className="block font-semibold text-fg">{s.name}</span>
              <span className="block text-xs font-normal text-fg-3">
                Official heading: {s.officialName} · {plural(s.topics.length, "topic")} · {plural(phrases, "syllabus phrase")}
              </span>
            </span>
          </button>
        </h2>
        <p className="tnum flex flex-wrap gap-x-3 gap-y-1 pl-9 text-xs text-fg-3 sm:pl-0 sm:text-right">
          <span>{plural(s.pyqCount, "PYQ")}</span>
          {ready ? (
            <>
              <span>
                {subject.pyqDone}/{subject.pyqTotal} done
              </span>
              <span>{subject.attempted ? `${pct(subject.accuracy, 0)} accuracy` : "no answers yet"}</span>
              {revisionDue ? <span className="font-medium text-warning">{revisionDue} due for revision</span> : null}
            </>
          ) : null}
          <Link href={`/subjects/${s.id}`} className="font-medium text-accent-text hover:underline">
            Subject page<span className="sr-only">: {s.name}</span>
          </Link>
        </p>
      </div>
      <div id={bodyId} hidden={!open} className="@container border-t border-border">
        <OfficialSyllabusText heading={s.officialName} text={s.officialText} status={s.syllabusStatus} sources={s.sources} className="bg-surface-2/60 px-4 py-4 sm:px-5" />
        <div aria-hidden className={cn(ROW_GRID, "hidden border-y border-border bg-surface-2 px-2 py-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-fg-3 @4xl:grid sm:px-3")}>
          <span />
          <span>Topic · syllabus phrase</span>
          <span>PYQs</span>
          <span>Practice</span>
          <span>Completion</span>
          <span>Accuracy</span>
          <span>Your topic mastery</span>
          <span>Revision</span>
        </div>
        <ul aria-label={`${s.name} topics`}>
          {s.topics.map((t) => {
            const topicOpen = openTopics.has(t.id);
            const subId = `syl-sub-${t.id}`;
            return (
              <li key={t.id} className="border-t border-border first:border-t-0">
                <div className={cn(ROW_GRID, "px-2 py-2 sm:px-3")}>
                  <Toggle open={topicOpen} onClick={() => onToggleTopic(t.id)} controls={subId} label={`${topicOpen ? "Hide" : "Show"} the ${t.subtopics.length} syllabus phrases of ${t.name}`} />
                  <div className="min-w-0">
                    <Link href={`/subjects/${s.id}/topics/${t.id}`} className="font-medium text-fg hover:text-accent-text hover:underline">
                      {t.name}
                    </Link>
                    <span className="ml-1.5 text-xs text-fg-3">{plural(t.subtopics.length, "phrase")}</span>
                  </div>
                  <Metrics pyqs={t.pyqCount} pyqHref={`/pyqs/browse?subject=${s.id}&topic=${t.id}`} practice={t.practiceCount} p={topicProgress.get(t.id)} status={status} />
                </div>
                <ul id={subId} hidden={!topicOpen} aria-label={`Syllabus phrases of ${t.name}`} className="border-t border-dashed border-border bg-surface-2/40">
                  {t.subtopics.map((st) => (
                    <li key={st.id} className={cn(ROW_GRID, "border-b border-border/60 px-2 py-2 last:border-b-0 sm:px-3")}>
                      <span aria-hidden className="justify-self-center text-fg-3">
                        ·
                      </span>
                      <div className="min-w-0 pl-2 md:pl-3">
                        <p className="text-sm text-fg">{st.name}</p>
                        <p className="text-xs text-fg-3">&ldquo;{st.officialPhrase}&rdquo;</p>
                      </div>
                      <Metrics pyqs={st.pyqCount} practice={st.practiceCount} p={subtopicProgress.get(st.id)} status={status} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
