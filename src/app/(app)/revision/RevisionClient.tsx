"use client";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Play, RotateCcw } from "lucide-react";
import type { Catalog } from "@/lib/server/repo";
import type { RevisionItemRow } from "@/lib/userdata/db";
import { useRevisionItems, useUserData } from "@/lib/userdata/hooks";
import { addToRevision, removeFromRevision } from "@/lib/userdata/ops";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { isFrequentlyForgotten, MAX_EASE, MAX_INTERVAL_DAYS, MIN_EASE, START_EASE } from "@/lib/revision/schedule";
import { useStorageValue } from "@/lib/useStorage";
import { SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatDate, pct, plural } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { ContentPicker, type PickerOption } from "@/components/review/ContentPicker";
import { QueueTabs, type QueueTab } from "@/components/review/QueueTabs";
import { RevisionItemList, type RowContext } from "@/components/review/RevisionItemList";
import { RevisionSession } from "@/components/review/RevisionSession";
import { ListSkeleton, StorageUnavailable, dayOf, isPyqId, relativeDay, shiftDay, useTableStatus, useToday } from "@/components/review/shared";
import type { HighWeightTopic, ReviewConcept, ReviewFormula } from "@/components/review/types";

type QueueId = "today" | "weak" | "incorrect" | "forgotten" | "high" | "pyq" | "all";
const QUEUE_IDS: QueueId[] = ["today", "weak", "incorrect", "forgotten", "high", "pyq", "all"];
const QUEUE_LABEL: Record<QueueId, string> = {
  today: "Today's revision",
  weak: "Weak topics",
  incorrect: "Incorrect questions",
  forgotten: "Frequently forgotten",
  high: "High-weight topics",
  pyq: "PYQs to reattempt",
  all: "All items",
};
const TAB_KEY = "gate-da-revision-queue";
const PANEL_ID = "revision-queue-panel";

const byDue = (a: RevisionItemRow, b: RevisionItemRow) => a.nextReview.localeCompare(b.nextReview) || a.createdAt.localeCompare(b.createdAt);

export interface RevisionClientProps {
  catalog: Catalog;
  concepts: ReviewConcept[];
  formulas: ReviewFormula[];
  highWeight: HighWeightTopic[];
  highWeightThreshold: number;
  paperCount: number;
  availableMocks: string[];
  subjectOrder: string[];
}

export function RevisionClient(props: RevisionClientProps) {
  const { catalog, concepts, formulas, highWeight, availableMocks } = props;
  const { db } = useUserData();
  const items = useRevisionItems();
  const model = useProgressModel(catalog);
  const revStatus = useTableStatus("revisionItems", items);
  const attStatus = useTableStatus("attempts", model.attempts);
  const today = useToday();
  const [storedTab, setStoredTab] = useStorageValue(TAB_KEY, "session");
  const tab: QueueId = QUEUE_IDS.includes(storedTab as QueueId) ? (storedTab as QueueId) : "today";
  const [session, setSession] = useState<{ title: string; keys: string[] } | null>(null);
  const [notice, setNotice] = useState("");
  const panelHeading = useRef<HTMLHeadingElement>(null);

  const topicName = useMemo(() => new Map(catalog.topics.map((t) => [t.id, t.name])), [catalog]);
  const conceptMap = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const formulaMap = useMemo(() => new Map(formulas.map((f) => [f.id, f])), [formulas]);
  const highMap = useMemo(() => new Map(highWeight.map((h) => [h.topicId, h])), [highWeight]);
  const mockSet = useMemo(() => new Set(availableMocks), [availableMocks]);
  const weakIds = useMemo(() => new Set(model.weak.map((w) => w.topicId)), [model.weak]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const inQueue = useMemo(() => new Set(items.map((i) => i.key)), [items]);

  const queues = useMemo(() => {
    const t = today ?? "9999-12-31";
    const sorted = [...items].sort(byDue);
    return {
      today: sorted.filter((i) => i.nextReview <= t),
      weak: sorted.filter((i) => i.topicId && weakIds.has(i.topicId)),
      incorrect: sorted.filter((i) => i.reasons.includes("incorrect")),
      forgotten: sorted.filter((i) => isFrequentlyForgotten(i)),
      high: sorted.filter((i) => i.topicId && highMap.has(i.topicId)),
      pyq: sorted.filter((i) => i.kind === "question" && isPyqId(i.refId)),
      all: sorted,
    } satisfies Record<QueueId, RevisionItemRow[]>;
  }, [items, today, weakIds, highMap]);

  const pickerOptions = useMemo<PickerOption[]>(
    () => [
      ...formulas.map((f) => ({ kind: "formula" as const, id: f.id, title: f.name, subjectId: f.subjectId, topicId: f.topicId, topicName: topicName.get(f.topicId) ?? f.topicId })),
      ...concepts.map((c) => ({ kind: "concept" as const, id: c.id, title: c.title, subjectId: c.subjectId, topicId: c.topicId, topicName: topicName.get(c.topicId) ?? c.topicId })),
    ],
    [formulas, concepts, topicName],
  );

  if (revStatus === "unavailable") return <StorageUnavailable what="revision queue" />;
  if (revStatus === "loading" || attStatus === "loading" || !today) return <ListSkeleton label="Loading your revision queue…" />;

  const start = (title: string, list: RevisionItemRow[]) => {
    if (!list.length) return;
    setNotice("");
    setSession({ title, keys: list.map((i) => i.key) });
    window.scrollTo({ top: 0 });
  };

  if (session) {
    return (
      <RevisionSession
        title={session.title}
        keys={session.keys}
        items={itemMap}
        today={today}
        concepts={conceptMap}
        formulas={formulaMap}
        topicName={topicName}
        availableMocks={mockSet}
        onExit={() => {
          setSession(null);
          requestAnimationFrame(() => panelHeading.current?.focus());
        }}
      />
    );
  }

  const ctx: RowContext = {
    today,
    topicName,
    weakTopics: weakIds,
    highWeight: highMap,
    availableMocks: mockSet,
    inLibrary: (it) => (it.kind === "concept" ? conceptMap.has(it.refId) : it.kind === "formula" ? formulaMap.has(it.refId) : true),
    canEdit: Boolean(db),
    onReview: (key) => {
      const it = itemMap.get(key);
      if (it) start(it.title, [it]);
    },
    onRemove: async (key) => {
      if (!db) return;
      const title = itemMap.get(key)?.title ?? "Item";
      await removeFromRevision(db, key);
      setNotice(`Removed “${title}” from your revision queue.`);
    },
  };

  const reviewedToday = items.filter((i) => i.lastReviewed && dayOf(i.lastReviewed) === today).length;
  const overdue = queues.today.filter((i) => i.nextReview < today).length;
  const week = shiftDay(today, 7);
  const tomorrow = shiftDay(today, 1);
  const upcoming = items.filter((i) => i.nextReview > today && i.nextReview <= week);
  const questionsInQueue = items.filter((i) => i.kind === "question").length;

  const tabs: QueueTab<QueueId>[] = QUEUE_IDS.map((id) => ({ id, label: QUEUE_LABEL[id], count: queues[id].length, emphasis: id === "today" && overdue > 0 }));
  const current = queues[tab];

  return (
    <div className="space-y-6">
      <section aria-label="Revision summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due today" value={queues.today.length} hint={items.length ? (overdue ? `${overdue} overdue` : "Nothing overdue") : "Queue is empty"} />
        <Stat label="Reviewed today" value={reviewedToday} hint={reviewedToday ? "Graded today" : "No reviews yet today"} />
        <Stat label="In your queue" value={items.length} hint={`${plural(questionsInQueue, "question")}${items.length - questionsInQueue ? ` + ${items.length - questionsInQueue} more` : ""}`} />
        <Stat label="Next 7 days" value={upcoming.length} hint={`Tomorrow: ${upcoming.filter((i) => i.nextReview === tomorrow).length}`} />
      </section>

      <p role="status" aria-live="polite" className={cn("text-sm text-fg-2", !notice && "sr-only")}>
        {notice}
      </p>

      {items.length === 0 ? (
        <EmptyState
          title="Your revision queue is empty"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/pyqs" variant="primary">
                Practise official PYQs
              </ButtonLink>
              <ButtonLink href="/practice">Build a practice set</ButtonLink>
            </div>
          }
        >
          Questions you answer incorrectly are added here automatically and are due the same day. Start by practising PYQs. You can also use “Add to revision” on any question, or add
          a formula or concept below.
        </EmptyState>
      ) : (
        <section aria-label="Revision queues" className="space-y-4">
          <QueueTabs tabs={tabs} value={tab} onChange={(v) => setStoredTab(v)} panelId={PANEL_ID} label="Revision queues" />
          <div id={PANEL_ID} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-3xl">
                <h2 ref={panelHeading} tabIndex={-1} className="text-lg font-semibold text-fg">
                  {QUEUE_LABEL[tab]} <span className="tnum font-normal text-fg-3">({current.length})</span>
                </h2>
                <p className="mt-0.5 text-sm text-fg-3">
                  <QueueDescription id={tab} {...props} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tab === "pyq" && current.length ? (
                  <ButtonLink href={`/practice?ids=${current.slice(0, 100).map((i) => i.refId).join(",")}`} className="max-sm:h-10">
                    <RotateCcw aria-hidden className="h-4 w-4" /> Reattempt as a practice set
                  </ButtonLink>
                ) : null}
                {current.length ? (
                  <Button variant="primary" onClick={() => start(QUEUE_LABEL[tab], current)} disabled={!db}>
                    <Play aria-hidden className="h-4 w-4" /> Start review ({current.length})
                  </Button>
                ) : null}
              </div>
            </div>
            {tab !== "today" && current.some((i) => i.nextReview > today) ? (
              <p className="text-xs text-fg-3">Items not yet due can be reviewed early: your grade reschedules them from today.</p>
            ) : null}
            <QueuePanel id={tab} list={current} ctx={ctx} model={model} highWeight={highWeight} items={items} />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <HowItWorks />
        <Card>
          <CardHeader title="Add a concept or formula" description="Queue something you want to keep fresh. It is due today, then follows your grades." />
          <CardBody className="space-y-3">
            <ContentPicker
              options={pickerOptions}
              inQueue={inQueue}
              disabled={!db || !pickerOptions.length}
              onPick={async (o) => {
                if (!db) return;
                await addToRevision(db, { kind: o.kind, refId: o.id, title: o.title, subjectId: o.subjectId, topicId: o.topicId, reason: "manual" });
              }}
            />
            <PickerCoverage concepts={concepts} formulas={formulas} subjectOrder={props.subjectOrder} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ queue text

function QueueDescription({ id, highWeight, highWeightThreshold, paperCount }: { id: QueueId } & RevisionClientProps) {
  switch (id) {
    case "today":
      return <>Items due today or overdue, oldest first. New items and fresh mistakes are due the day they are added.</>;
    case "weak":
      return <>Items in your weak topics: topics where you have given at least 3 answers with under 70% accuracy (your own attempts, ranked by a confidence-adjusted accuracy).</>;
    case "incorrect":
      return <>Questions you have answered incorrectly. Incorrect answers are added to revision automatically.</>;
    case "forgotten":
      return <>Items you have graded Forgot at least twice, or graded Forgot again after two or more reviews.</>;
    case "high":
      return (
        <>
          Items in the {highWeight.length} topics that carried the most marks ({highWeightThreshold} or more each) across the {paperCount} official GATE DA papers. Historically
          high-weight is a historical observation, not a prediction of the next paper.
        </>
      );
    case "pyq":
      return <>Official GATE PYQs in your queue. Reattempt them here one by one with a recall grade, or all together as a practice set.</>;
    case "all":
      return <>Everything in your revision queue, by next review date.</>;
  }
}

function QueuePanel({
  id,
  list,
  ctx,
  model,
  highWeight,
  items,
}: {
  id: QueueId;
  list: RevisionItemRow[];
  ctx: RowContext;
  model: ReturnType<typeof useProgressModel>;
  highWeight: HighWeightTopic[];
  items: RevisionItemRow[];
}) {
  if (id === "weak") {
    if (!model.weak.length) {
      return (
        <EmptyState title="No weak topics right now" action={<ButtonLink href="/practice">Build a practice set</ButtonLink>}>
          A topic counts as weak once you have given at least 3 answers in it with under 70% accuracy. Keep practising; weak topics and their revision items will show up here.
        </EmptyState>
      );
    }
    return (
      <div className="space-y-5">
        {model.weak.map((w) => {
          const inTopic = list.filter((i) => i.topicId === w.topicId);
          return (
            <section key={w.topicId} aria-labelledby={`weak-${w.topicId}`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 id={`weak-${w.topicId}`} className="font-semibold text-fg">
                    {w.name}
                  </h3>
                  <p className="text-xs text-fg-3">
                    {w.subjectId ? `${SUBJECT_SHORT[w.subjectId as keyof typeof SUBJECT_SHORT]} · ` : ""}
                    {w.correct} of {w.attempted} correct ({pct(w.accuracy, 0)}) · {plural(inTopic.length, "revision item")}
                  </p>
                </div>
                <ButtonLink href={`/practice?topic=${encodeURIComponent(w.topicId)}&count=5`} size="sm" className="max-sm:h-10" aria-label={`Practise 5 questions on ${w.name}`}>
                  Practise 5 questions
                </ButtonLink>
              </div>
              {inTopic.length ? (
                <RevisionItemList items={inTopic} ctx={ctx} label={`Revision items in ${w.name}`} />
              ) : (
                <p className="rounded-[var(--radius)] border border-dashed border-border-strong px-4 py-3 text-sm text-fg-3">
                  No revision items in this topic yet. Practise it: every wrong answer is queued here automatically.
                </p>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  if (id === "high") {
    const groups = highWeight.filter((h) => list.some((i) => i.topicId === h.topicId));
    return (
      <div className="space-y-5">
        <details className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-fg">Which topics are historically high-weight?</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {highWeight.map((h) => (
              <li key={h.topicId} className="flex justify-between gap-3 text-fg-2">
                <Link href={`/subjects/${h.subjectId}/topics/${h.topicId}`} className="min-w-0 truncate hover:underline">
                  {h.name}
                </Link>
                <span className="tnum shrink-0 text-fg-3">
                  {h.marks} marks · {plural(h.papersAppeared, "paper")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-3">Historical estimate from the official papers; see Weightage for the full breakdown.</p>
        </details>
        {groups.length ? (
          groups.map((h) => (
            <section key={h.topicId} aria-labelledby={`high-${h.topicId}`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 id={`high-${h.topicId}`} className="font-semibold text-fg">
                    {h.name}
                  </h3>
                  <p className="text-xs text-fg-3">
                    {SUBJECT_SHORT[h.subjectId]} · historically high-weight: {h.marks} marks in {plural(h.questions, "question")} across the official papers
                  </p>
                </div>
                <ButtonLink href={`/practice?topic=${encodeURIComponent(h.topicId)}&count=5`} size="sm" className="max-sm:h-10" aria-label={`Practise 5 questions on ${h.name}`}>
                  Practise 5 questions
                </ButtonLink>
              </div>
              <RevisionItemList items={list.filter((i) => i.topicId === h.topicId)} ctx={ctx} label={`Revision items in ${h.name}`} />
            </section>
          ))
        ) : (
          <EmptyState title="None of your revision items is in a historically high-weight topic">
            Open the list above to see those topics, and practise their PYQs: wrong answers join this queue automatically.
          </EmptyState>
        )}
      </div>
    );
  }

  if (!list.length) {
    const next = [...items].sort(byDue)[0];
    const empty: Record<Exclude<QueueId, "weak" | "high">, { title: string; body: ReactNode; action?: ReactNode }> = {
      today: {
        title: "Nothing is due today",
        body: next ? (
          <>
            Your next item, “{next.title}”, is due {formatDate(next.nextReview)} ({relativeDay(next.nextReview, ctx.today)}). You can review any other queue early, or keep practising: wrong
            answers are due the same day.
          </>
        ) : (
          "Wrong answers are added automatically and are due the same day."
        ),
        action: <ButtonLink href="/practice">Build a practice set</ButtonLink>,
      },
      incorrect: {
        title: "No incorrect answers in your queue",
        body: "Questions you answer incorrectly are added here automatically, due the same day.",
        action: <ButtonLink href="/pyqs">Practise official PYQs</ButtonLink>,
      },
      forgotten: {
        title: "Nothing is frequently forgotten",
        body: "An item appears here after you grade it Forgot twice, or Forgot again after two or more reviews.",
      },
      pyq: {
        title: "No official PYQs in your queue",
        body: "Official PYQs you answer incorrectly, or add with “Add to revision”, appear here to reattempt.",
        action: <ButtonLink href="/pyqs">Browse PYQs</ButtonLink>,
      },
      all: { title: "Your revision queue is empty", body: "" },
    };
    const e = empty[id];
    return (
      <EmptyState title={e.title} action={e.action}>
        {e.body}
      </EmptyState>
    );
  }

  return <RevisionItemList items={list} ctx={ctx} label={QUEUE_LABEL[id]} />;
}

// ------------------------------------------------------------------ explainer

function HowItWorks() {
  const rows: { grade: string; tone: string; text: string }[] = [
    { grade: "Got it", tone: "text-success", text: "3 days after a first review, 7 days while the interval is under a week, then the current interval × your ease factor." },
    { grade: "Almost", tone: "text-warning", text: "2 days after a first review; later, the current interval × 1.2 (never under 2 days)." },
    { grade: "Forgot", tone: "text-danger", text: "Tomorrow (1 day), and it counts as a lapse." },
  ];
  return (
    <Card>
      <CardHeader title="How spaced revision works" description="Review an item, grade how well you recalled it, and the grade sets the next review date." />
      <CardBody className="space-y-3">
        <dl className="space-y-2">
          {rows.map((r) => (
            <div key={r.grade} className="grid grid-cols-[4.5rem_1fr] gap-3 text-sm">
              <dt className={cn("font-semibold", r.tone)}>{r.grade}</dt>
              <dd className="text-fg-2">{r.text}</dd>
            </div>
          ))}
        </dl>
        <ul className="list-disc space-y-1 pl-5 text-xs text-fg-3">
          <li>New items are due the day they are added. A new wrong answer on a scheduled question brings it back to today.</li>
          <li>
            The ease factor starts at {START_EASE}: Got it adds 0.05, Almost takes off 0.05 and Forgot takes off 0.20, within {MIN_EASE} to {MAX_EASE}.
          </li>
          <li>No interval is longer than {MAX_INTERVAL_DAYS} days, so everything comes back well before the exam.</li>
          <li>Frequently forgotten: graded Forgot at least twice, or Forgot again after two or more reviews.</li>
        </ul>
      </CardBody>
    </Card>
  );
}

function PickerCoverage({ concepts, formulas, subjectOrder }: { concepts: ReviewConcept[]; formulas: ReviewFormula[]; subjectOrder: string[] }) {
  const formulaSubjects = subjectOrder.filter((s) => formulas.some((f) => f.subjectId === s)).map((s) => SUBJECT_SHORT[s as keyof typeof SUBJECT_SHORT]);
  if (!concepts.length && !formulas.length) {
    return <p className="text-xs text-fg-3">No concepts or formula cards are published yet. You can still add any question from its page with “Add to revision”.</p>;
  }
  return (
    <p className="text-xs text-fg-3">
      {concepts.length ? `${plural(concepts.length, "concept")} and ` : "The concept library has no published concepts yet, so only formulas can be added for now. "}
      {plural(formulas.length, "formula card")} {formulaSubjects.length ? `(${formulaSubjects.join(", ")})` : ""} available. To add a question, use “Add to revision” on the question page.
    </p>
  );
}
