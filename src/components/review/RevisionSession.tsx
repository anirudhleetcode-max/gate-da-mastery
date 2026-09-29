"use client";
/**
 * A review session over a fixed list of revision items. Question items are
 * fetched from /api/questions/<id> and attempted with QuestionView (context
 * "revision"); concept and formula items are recalled from memory. Every item
 * is then graded Forgot / Almost / Got it with gradeRevision.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ExternalLink, LogOut, SkipForward, Trash2, WifiOff } from "lucide-react";
import type { QuestionPayload } from "@/lib/server/payload";
import type { RevisionItemRow } from "@/lib/userdata/db";
import type { RecallGrade } from "@/lib/revision/schedule";
import { useUserData } from "@/lib/userdata/hooks";
import { gradeRevision, removeFromRevision } from "@/lib/userdata/ops";
import { QuestionView } from "@/components/question/QuestionView";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { ProgressBar } from "@/components/ui/Progress";
import { RichHtml } from "@/components/ui/RichHtml";
import { Stat } from "@/components/ui/Stat";
import { SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatDate, plural } from "@/lib/utils";
import type { ReviewConcept, ReviewFormula } from "./types";
import { GradeResult, RecallGrader } from "./RecallGrader";
import { GRADE_LABEL, KIND_LABEL, relativeDay } from "./shared";

type Outcome = { kind: "graded"; grade: RecallGrade; nextReview: string } | { kind: "skipped" } | { kind: "removed" } | { kind: "unavailable" };

export function RevisionSession({
  title,
  keys,
  items,
  today,
  concepts,
  formulas,
  topicName,
  onExit,
}: {
  title: string;
  /** Item keys fixed when the session started (grading changes due dates, not the session). */
  keys: string[];
  /** Live revision items by key. */
  items: ReadonlyMap<string, RevisionItemRow>;
  today: string;
  concepts: ReadonlyMap<string, ReviewConcept>;
  formulas: ReadonlyMap<string, ReviewFormula>;
  topicName: ReadonlyMap<string, string>;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const finished = index >= keys.length;

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  // Warm the HTTP cache with the next question so moving on is instant.
  useEffect(() => {
    const next = keys[index + 1];
    if (next?.startsWith("question:")) void fetch(`/api/questions/${encodeURIComponent(next.slice(9))}`).catch(() => undefined);
  }, [index, keys]);

  const record = (key: string, o: Outcome) => setOutcomes((prev) => ({ ...prev, [key]: o }));
  const next = () => setIndex((i) => i + 1);

  if (finished) {
    const values = Object.values(outcomes);
    const count = (g: RecallGrade) => values.filter((o) => o.kind === "graded" && o.grade === g).length;
    const skipped = keys.length - values.filter((o) => o.kind === "graded" || o.kind === "removed").length;
    return (
      <section aria-labelledby="rev-summary" className="space-y-4">
        <h2 id="rev-summary" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-fg">
          Review session complete
        </h2>
        <p className="text-sm text-fg-2">
          {title}: {plural(keys.length, "item")}. Each graded item has its next review date set; skipped items stay where they were in the queue.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Got it" value={count("got_it")} />
          <Stat label="Almost" value={count("almost")} />
          <Stat label="Forgot" value={count("forgot")} />
          <Stat label="Skipped" value={skipped} hint={values.some((o) => o.kind === "removed") ? `${values.filter((o) => o.kind === "removed").length} removed` : undefined} />
        </div>
        <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
          {keys.map((k) => {
            const it = items.get(k);
            const o = outcomes[k];
            return (
              <li key={k} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate text-fg">{it?.title ?? k.split(":").slice(1).join(":")}</span>
                <span className={cn("shrink-0", o?.kind === "graded" ? "text-fg-2" : "text-fg-3")}>
                  {o?.kind === "graded"
                    ? `${GRADE_LABEL[o.grade]} · next ${formatDate(o.nextReview)}`
                    : o?.kind === "removed"
                      ? "Removed from revision"
                      : o?.kind === "unavailable"
                        ? "Temporarily unavailable"
                        : "Skipped"}
                </span>
              </li>
            );
          })}
        </ul>
        <Button variant="primary" onClick={onExit}>
          Back to revision queues
        </Button>
      </section>
    );
  }

  const key = keys[index];
  const item = items.get(key);
  const outcome = outcomes[key];

  return (
    <section aria-labelledby="rev-session" className="space-y-5">
      <div className="space-y-2 rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rev-session" ref={headingRef} tabIndex={-1} className="min-w-0 text-base font-semibold text-fg">
            Review session: {title}
            <span className="tnum ml-2 font-normal text-fg-3">
              Item {index + 1} of {keys.length}
            </span>
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setIndex(keys.length)} className="max-sm:h-10">
            <LogOut aria-hidden className="h-4 w-4" /> End session
          </Button>
        </div>
        <ProgressBar value={index} max={keys.length} label={`Review progress: ${index} of ${keys.length} done`} />
      </div>

      {!item && outcome?.kind !== "removed" ? (
        <Callout tone="info" title="This item is no longer in your revision queue">
          It was removed on another page or tab.{" "}
          <button type="button" onClick={next} className="font-medium text-accent-text underline">
            Continue
          </button>
        </Callout>
      ) : (
        <SessionItem
          key={key}
          itemKey={key}
          item={item}
          today={today}
          outcome={outcome}
          concepts={concepts}
          formulas={formulas}
          topicName={topicName}
          onOutcome={(o) => record(key, o)}
          onNext={next}
          isLast={index === keys.length - 1}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ one item

type Fetch = { status: "loading" } | { status: "ok"; q: QuestionPayload } | { status: "missing" } | { status: "error"; offline: boolean };

function useQuestionPayload(id: string | null) {
  const [state, setState] = useState<Fetch>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/questions/${encodeURIComponent(id)}`, { signal: ctrl.signal });
        if (res.status === 404) setState({ status: "missing" });
        else if (!res.ok) setState({ status: "error", offline: false });
        else setState({ status: "ok", q: (await res.json()) as QuestionPayload });
      } catch {
        if (!ctrl.signal.aborted) setState({ status: "error", offline: typeof navigator !== "undefined" && !navigator.onLine });
      }
    })();
    return () => ctrl.abort();
  }, [id, attempt]);
  const retry = () => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  };
  return { state, retry };
}

function SessionItem({
  itemKey,
  item,
  today,
  outcome,
  concepts,
  formulas,
  topicName,
  onOutcome,
  onNext,
  isLast,
}: {
  itemKey: string;
  item: RevisionItemRow | undefined;
  today: string;
  outcome: Outcome | undefined;
  concepts: ReadonlyMap<string, ReviewConcept>;
  formulas: ReadonlyMap<string, ReviewFormula>;
  topicName: ReadonlyMap<string, string>;
  onOutcome: (o: Outcome) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { db } = useUserData();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const kind = item?.kind ?? (itemKey.split(":")[0] as RevisionItemRow["kind"]);
  const refId = item?.refId ?? itemKey.slice(kind.length + 1);
  const { state, retry } = useQuestionPayload(kind === "question" ? refId : null);
  const graded = outcome?.kind === "graded" ? outcome : null;

  useEffect(() => {
    if (graded || outcome?.kind === "removed") nextRef.current?.focus();
  }, [graded, outcome]);

  async function grade(g: RecallGrade) {
    if (!db || !item) return;
    setBusy(true);
    try {
      const updated = await gradeRevision(db, item.key, g);
      if (updated) onOutcome({ kind: "graded", grade: g, nextReview: updated.nextReview });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!db) return;
    setBusy(true);
    try {
      await removeFromRevision(db, itemKey);
      onOutcome({ kind: "removed" });
    } finally {
      setBusy(false);
    }
  }

  const title = item?.title ?? refId;
  const subject = item?.subjectId ? SUBJECT_SHORT[item.subjectId] : null;
  const topic = item?.topicId ? topicName.get(item.topicId) : null;

  const unavailable = kind === "question" && state.status === "missing";
  const questionReady = kind === "question" && state.status === "ok";

  let body: ReactNode;
  if (kind === "question") {
    if (state.status === "loading") {
      body = (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading the question…</span>
          <div className="h-6 w-1/3 animate-pulse rounded bg-surface-2" />
          <div className="h-48 animate-pulse rounded-[var(--radius)] bg-surface-2" />
        </div>
      );
    } else if (state.status === "missing") {
      body = (
        <Callout tone="warning" title={`${title} is temporarily unavailable`}>
          This question is not being served right now. Mock-test questions are withdrawn while their mock is re-verified, and return once every question in that mock has passed
          review again. It stays in your queue unless you remove it; skip it for now or remove it below.
        </Callout>
      );
    } else if (state.status === "error") {
      body = (
        <Callout tone="danger" title="The question could not be loaded">
          <p>{state.offline ? "You appear to be offline. Questions are fetched when you open them, so reconnect and try again, or skip this item." : "The server did not answer. Try again, or skip this item."}</p>
          <Button size="sm" className="mt-2 max-sm:h-10" onClick={retry}>
            {state.offline ? <WifiOff aria-hidden className="h-4 w-4" /> : null} Try again
          </Button>
        </Callout>
      );
    } else {
      body = <QuestionView q={state.q} context="revision" headingLevel="h2" compact onSubmitted={() => setSubmitted(true)} />;
    }
  } else if (kind === "concept") {
    const c = concepts.get(refId);
    body = (
      <article aria-labelledby={`rev-c-${refId}`} className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info">{KIND_LABEL.concept}</Badge>
          {subject ? <Badge tone="outline">{subject}</Badge> : null}
        </div>
        <h2 id={`rev-c-${refId}`} className="text-lg font-semibold text-fg">
          {c?.title ?? title}
        </h2>
        {topic ? <p className="text-sm text-fg-3">Topic: {topic}</p> : null}
        <p className="text-sm text-fg-2">
          Before opening the concept, say or write out its definition, the key formula or result, when it applies in a GATE question, and one mistake students make with it. Then
          check yourself against the concept page and grade honestly.
        </p>
        {c ? (
          <a href={c.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-accent-text hover:bg-surface-2">
            Open the concept to check <ExternalLink aria-hidden className="h-4 w-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <p className="text-sm text-warning">This concept is not in the concept library any more, so it cannot be opened. Grade from memory or remove it.</p>
        )}
      </article>
    );
  } else {
    body = <FormulaRecall formula={formulas.get(refId)} fallbackTitle={title} subject={subject} topic={topic ?? null} />;
  }

  const gradePrompt =
    kind === "question"
      ? submitted
        ? "How well did you know this? Grade the recall, not just the result."
        : "Attempt the question (or reveal the answer), then grade how well you recalled the method."
      : "Grade how completely you recalled it before checking.";

  return (
    <div className="space-y-4">
      {kind === "question" && !questionReady ? (
        <p className="text-sm text-fg-3">
          {KIND_LABEL.question}: <span className="font-medium text-fg-2">{title}</span>
          {subject ? ` · ${subject}` : ""}
          {topic ? ` · ${topic}` : ""}
        </p>
      ) : null}
      {body}

      {outcome?.kind === "removed" ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
          <p className="text-sm text-fg-2">Removed from your revision queue.</p>
          <Button ref={nextRef} variant="primary" onClick={onNext} className="ml-auto">
            {isLast ? "Finish session" : "Next item"} <ArrowRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ) : graded ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
          <GradeResult grade={graded.grade} nextReview={graded.nextReview} today={today} />
          <Button ref={nextRef} variant="primary" onClick={onNext} className="ml-auto">
            {isLast ? "Finish session" : "Next item"} <ArrowRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          {item && !unavailable && !(kind === "question" && state.status !== "ok") ? (
            <RecallGrader item={item} today={today} onGrade={grade} disabled={busy || !db} prompt={gradePrompt} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                if (unavailable) onOutcome({ kind: "unavailable" });
                onNext();
              }}
              className="max-sm:h-10"
            >
              <SkipForward aria-hidden className="h-4 w-4" /> {isLast ? "Skip and finish" : "Skip for now"}
            </Button>
            {confirmRemove ? (
              <span className="flex flex-wrap items-center gap-2">
                <Button variant="danger" onClick={remove} disabled={busy || !db} className="max-sm:h-10">
                  <Trash2 aria-hidden className="h-4 w-4" /> Confirm removal
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemove(false)} className="max-sm:h-10">
                  Keep it
                </Button>
              </span>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRemove(true)} disabled={!db} className="max-sm:h-10">
                <Trash2 aria-hidden className="h-4 w-4" /> Remove from revision
              </Button>
            )}
            {item ? (
              <span className="ml-auto text-xs text-fg-3">
                Scheduled {item.nextReview <= today ? "for " : ""}
                {relativeDay(item.nextReview, today)}
                {item.reviewCount ? ` · reviewed ${plural(item.reviewCount, "time")}` : " · first review"}
                {item.confidence ? ` · last: ${GRADE_LABEL[item.confidence]}` : ""}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function FormulaRecall({ formula, fallbackTitle, subject, topic }: { formula: ReviewFormula | undefined; fallbackTitle: string; subject: string | null; topic: string | null }) {
  const [shown, setShown] = useState(false);
  const panelId = `rev-f-panel-${formula?.id ?? "missing"}`;
  const href = formula ? `/formulas/${formula.subjectId}#${formula.id}` : null;
  return (
    <article aria-labelledby={`rev-f-${formula?.id ?? "missing"}`} className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="info">{KIND_LABEL.formula}</Badge>
        {subject ? <Badge tone="outline">{subject}</Badge> : null}
      </div>
      <h2 id={`rev-f-${formula?.id ?? "missing"}`} className="text-lg font-semibold text-fg">
        {formula?.name ?? fallbackTitle}
      </h2>
      {topic ? <p className="text-sm text-fg-3">Topic: {topic}</p> : null}
      {formula ? (
        <>
          <p className="text-sm text-fg-2">Write the formula from memory, including what each symbol means and when it applies, then reveal it and compare.</p>
          <Button onClick={() => setShown((v) => !v)} aria-expanded={shown} aria-controls={panelId} className="max-sm:h-10">
            {shown ? "Hide the formula" : "Reveal the formula"}
          </Button>
          <div id={panelId} hidden={!shown} className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2">
            {shown ? <RichHtml html={formula.html} /> : null}
          </div>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
              Full card in the formula book <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-warning">This formula is not in the formula book any more, so it cannot be shown. Grade from memory or remove it.</p>
      )}
    </article>
  );
}

