"use client";
import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import { MISTAKE_LABELS, MISTAKE_TYPES, type ErrorLogRow, type MistakeType } from "@/lib/userdata/db";
import { useErrorLogs, useSetting, useUserData } from "@/lib/userdata/hooks";
import { addToRevision, updateErrorLog } from "@/lib/userdata/ops";
import { SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { cn, pct, plural } from "@/lib/utils";
import { BarList, ChartFrame } from "@/components/charts/Charts";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { ErrorCard, ErrorTableBody, STATUSES, STATUS_LABEL, type EntryContext, type RevisionStatus } from "@/components/review/ErrorEntry";
import { ListSkeleton, StorageUnavailable, dayOf, useMediaQuery, useTableStatus } from "@/components/review/shared";
import type { ReviewTaxonomy } from "@/components/review/types";

interface Filters {
  subject: string;
  topic: string;
  /** "" = any, "none" = not classified yet. */
  mistake: MistakeType | "none" | "";
  status: RevisionStatus | "";
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { subject: "", topic: "", mistake: "", status: "", from: "", to: "" };
const PAGE = 50;

function matches(e: ErrorLogRow, f: Filters): boolean {
  if (f.subject && e.subjectId !== f.subject) return false;
  if (f.topic && e.topicId !== f.topic) return false;
  if (f.mistake === "none" ? e.mistakeType !== null : f.mistake && e.mistakeType !== f.mistake) return false;
  if (f.status && e.revisionStatus !== f.status) return false;
  const d = dayOf(e.createdAt);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

export function ErrorLogClient({ taxonomy, conceptSuggestions, availableMocks }: { taxonomy: ReviewTaxonomy; conceptSuggestions: string[]; availableMocks: string[] }) {
  const { db } = useUserData();
  const entries = useErrorLogs();
  const status = useTableStatus("errorLogs", entries);
  const [autoLog] = useSetting("autoErrorLog", true);
  const wide = useMediaQuery("(min-width: 768px)", true);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const uid = useId();
  const listId = `${uid}-concepts`;

  const topicName = useMemo(() => new Map(taxonomy.topics.map((t) => [t.id, t.name])), [taxonomy]);
  const ctx: EntryContext = useMemo(() => ({ topicName, availableMocks: new Set(availableMocks), conceptListId: listId }), [topicName, availableMocks, listId]);
  const filtered = useMemo(() => entries.filter((e) => matches(e, filters)), [entries, filters]);

  // Filter options come from the log itself, with counts, so no option leads to nothing.
  const options = useMemo(() => {
    const count = (f: (e: ErrorLogRow) => boolean) => entries.filter(f).length;
    const subjects = taxonomy.subjects.map((s) => ({ id: s.id, label: SUBJECT_SHORT[s.id], n: count((e) => e.subjectId === s.id) })).filter((s) => s.n > 0);
    const topics = taxonomy.topics
      .filter((t) => !filters.subject || t.subjectId === filters.subject)
      .map((t) => ({ id: t.id, subjectId: t.subjectId, label: t.name, n: count((e) => e.topicId === t.id) }))
      .filter((t) => t.n > 0);
    return { subjects, topics };
  }, [entries, taxonomy, filters.subject]);

  if (status === "unavailable") return <StorageUnavailable what="error log" />;
  if (status === "loading") return <ListSkeleton label="Loading your error log…" />;

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE);
    setNotice(null);
  };
  const activeCount = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => filters[k] !== "").length;
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  const autoNote = (
    <>
      Incorrect answers to official PYQs, mock-test questions and practice questions are added here automatically while automatic error logging is on in{" "}
      <Link href="/settings" className="font-medium text-accent-text underline">
        Settings
      </Link>{" "}
      (on by default; <strong className="text-fg">currently {autoLog ? "on" : "off"}</strong>). Use “Add to error log” on any question to log one yourself. A repeated mistake on
      the same question updates its open entry.
    </>
  );

  if (!entries.length) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Your error log is empty"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/pyqs" variant="primary">
                Practise official PYQs
              </ButtonLink>
              <ButtonLink href="/practice">Build a practice set</ButtonLink>
            </div>
          }
        >
          {autoLog
            ? "Answer questions and every incorrect answer is logged here automatically. Then classify each mistake to see your patterns and send the questions back to revision."
            : "Automatic error logging is off, so incorrect answers are not logged for you. Turn it on in Settings, or use “Add to error log” on a question."}
        </EmptyState>
        <Callout title="How entries get here">{autoNote}</Callout>
      </div>
    );
  }

  const counts = {
    open: entries.filter((e) => e.revisionStatus === "open").length,
    revising: entries.filter((e) => e.revisionStatus === "revising").length,
    resolved: entries.filter((e) => e.revisionStatus === "resolved").length,
    unclassified: entries.filter((e) => e.mistakeType === null).length,
  };
  const uniqueQuestions = [...new Map(filtered.map((e) => [e.questionId, e])).values()];
  const openInFiltered = filtered.filter((e) => e.revisionStatus === "open");
  const shown = filtered.slice(0, limit);

  async function reviseThese() {
    if (!db || !uniqueQuestions.length) return;
    setBusy(true);
    try {
      for (const e of uniqueQuestions) {
        await addToRevision(db, { kind: "question", refId: e.questionId, title: e.title, subjectId: e.subjectId, topicId: e.topicId, reason: "incorrect" });
      }
      for (const e of openInFiltered) if (e.id !== undefined) await updateErrorLog(db, e.id, { revisionStatus: "revising" });
      setNotice(
        <>
          {plural(uniqueQuestions.length, "question")} queued for revision, due today.
          {openInFiltered.length ? ` ${plural(openInFiltered.length, "open entry", "open entries")} marked Revising.` : ""}{" "}
          <Link href="/revision" className="font-medium text-accent-text underline">
            Go to revision
          </Link>
        </>,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <datalist id={listId}>
        {conceptSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <section aria-label="Error log summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entries" value={entries.length} hint={counts.unclassified ? `${counts.unclassified} not classified yet` : "All classified"} />
        <Stat label="Open" value={counts.open} hint="Not yet revised" />
        <Stat label="Revising" value={counts.revising} hint="In your revision queue" />
        <Stat label="Resolved" value={counts.resolved} hint={pct(entries.length ? counts.resolved / entries.length : null, 0) + " of entries"} />
      </section>

      <Callout title="How entries get here">{autoNote}</Callout>

      {/* ------------------------------------------------ filters */}
      <section aria-labelledby="err-filters-h" className="rounded-[var(--radius)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="err-filters-h" className="text-sm font-semibold text-fg">
            Filters{activeCount ? <span className="font-normal text-fg-3"> · {activeCount} active</span> : null}
          </h2>
          <div className="flex gap-2">
            {activeCount ? (
              <Button size="sm" variant="ghost" className="max-md:h-10" onClick={() => setFilter(NO_FILTERS)}>
                Reset filters
              </Button>
            ) : null}
            <Button size="sm" className="h-10 md:hidden" aria-expanded={filtersOpen} aria-controls={`${uid}-fields`} onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" /> {filtersOpen ? "Hide filters" : "Show filters"}
            </Button>
          </div>
        </div>
        <div id={`${uid}-fields`} className={cn("mt-3 gap-3 min-[400px]:grid-cols-2 md:grid md:grid-cols-3", filtersOpen ? "grid" : "hidden")}>
          <FilterSelect id={`${uid}-subject`} label="Subject" value={filters.subject} onChange={(v) => setFilter({ subject: v, topic: v && taxonomy.topics.find((t) => t.id === filters.topic)?.subjectId !== v ? "" : filters.topic })}>
            <option value="">All subjects ({entries.length})</option>
            {options.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.n})
              </option>
            ))}
          </FilterSelect>
          <FilterSelect id={`${uid}-topic`} label="Topic" value={filters.topic} onChange={(v) => setFilter({ topic: v, subject: v ? (taxonomy.topics.find((t) => t.id === v)?.subjectId ?? filters.subject) : filters.subject })}>
            <option value="">All topics</option>
            {options.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.n})
              </option>
            ))}
          </FilterSelect>
          <FilterSelect id={`${uid}-mistake`} label="Mistake type" value={filters.mistake} onChange={(v) => setFilter({ mistake: v as Filters["mistake"] })}>
            <option value="">All mistake types</option>
            {MISTAKE_TYPES.map((m) => (
              <option key={m} value={m}>
                {MISTAKE_LABELS[m]} ({entries.filter((e) => e.mistakeType === m).length})
              </option>
            ))}
            <option value="none">Not classified ({counts.unclassified})</option>
          </FilterSelect>
          <FilterSelect id={`${uid}-status`} label="Revision status" value={filters.status} onChange={(v) => setFilter({ status: v as Filters["status"] })}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]} ({counts[s]})
              </option>
            ))}
          </FilterSelect>
          <DateField id={`${uid}-from`} label="Logged from" value={filters.from} max={filters.to || undefined} onChange={(v) => setFilter({ from: v })} />
          <DateField id={`${uid}-to`} label="Logged until" value={filters.to} min={filters.from || undefined} onChange={(v) => setFilter({ to: v })} />
        </div>
        {badRange ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            The start date is after the end date, so nothing can match. Change one of the dates.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------ summary */}
      {filtered.length ? <Summary entries={filtered} taxonomy={taxonomy} filtered={activeCount > 0} /> : null}

      {/* ------------------------------------------------ entries */}
      <section aria-labelledby="err-list-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="err-list-h" className="text-lg font-semibold text-fg">
              Entries
            </h2>
            <p role="status" aria-live="polite" className="text-sm text-fg-3">
              {filtered.length === entries.length ? `${plural(entries.length, "entry", "entries")}, newest first` : `${filtered.length} of ${plural(entries.length, "entry", "entries")} match the filters, newest first`}
            </p>
          </div>
          <Button variant="primary" disabled={!db || busy || !uniqueQuestions.length} onClick={reviseThese}>
            <RotateCcw aria-hidden className="h-4 w-4" /> Revise these ({uniqueQuestions.length})
          </Button>
        </div>
        <p className="text-xs text-fg-3">
          “Revise these” puts every question listed here into your revision queue, due today, and marks open entries as Revising.
        </p>
        {notice ? (
          <p role="status" className="rounded-lg bg-success-soft px-4 py-2.5 text-sm text-fg">
            {notice}
          </p>
        ) : null}

        {!filtered.length ? (
          <EmptyState title="No entries match these filters" action={<Button onClick={() => setFilter(NO_FILTERS)}>Reset filters</Button>}>
            Widen the date range or clear a filter to see more of your error log.
          </EmptyState>
        ) : wide ? (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Error log entries, newest first</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-3">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Question
                  </th>
                  <th scope="col" className="w-32 px-3 py-2 font-medium">
                    Answers
                  </th>
                  <th scope="col" className="w-56 px-3 py-2 font-medium">
                    Mistake type
                  </th>
                  <th scope="col" className="w-36 px-3 py-2 font-medium">
                    Revision status
                  </th>
                  <th scope="col" className="w-28 px-3 py-2 text-right font-medium">
                    Logged
                  </th>
                </tr>
              </thead>
              {shown.map((e) => (
                <ErrorTableBody key={e.id} entry={e} ctx={ctx} />
              ))}
            </table>
          </div>
        ) : (
          <ul aria-label="Error log entries" className="space-y-3">
            {shown.map((e) => (
              <ErrorCard key={e.id} entry={e} ctx={ctx} />
            ))}
          </ul>
        )}
        {filtered.length > shown.length ? (
          <div className="flex justify-center">
            <Button onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, filtered.length - shown.length)} more ({filtered.length - shown.length} not shown)
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ summary charts

function Summary({ entries, taxonomy, filtered }: { entries: ErrorLogRow[]; taxonomy: ReviewTaxonomy; filtered: boolean }) {
  const total = entries.length;
  const byType = [
    ...MISTAKE_TYPES.map((m) => ({ key: m, label: MISTAKE_LABELS[m], value: entries.filter((e) => e.mistakeType === m).length })),
    { key: "none", label: "Not classified", value: entries.filter((e) => e.mistakeType === null).length },
  ].filter((d) => d.key !== "none" || d.value > 0);
  const bySubject = taxonomy.subjects
    .map((s) => ({ key: s.id, label: SUBJECT_SHORT[s.id as SubjectId], value: entries.filter((e) => e.subjectId === s.id).length, color: SUBJECT_COLOR[s.id as SubjectId] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const scope = filtered ? `${plural(total, "entry", "entries")} matching the filters` : `all ${plural(total, "entry", "entries")}`;
  const share = (v: number) => pct(total ? v / total : null, 0);
  return (
    <section aria-labelledby="err-summary-h" className="space-y-3">
      <h2 id="err-summary-h" className="text-lg font-semibold text-fg">
        Your mistake patterns
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Mistakes by type"
          description={`Across ${scope}. Classify open entries to make this more useful.`}
          table={{ columns: ["Mistake type", "Entries", "Share"], rows: byType.map((d) => [d.label, d.value, share(d.value)]) }}
        >
          <BarList ariaLabel="Mistakes by type" data={byType.map((d) => ({ ...d, color: "var(--accent)", display: `${d.value} · ${share(d.value)}` }))} />
        </ChartFrame>
        <ChartFrame
          title="Mistakes by subject"
          description={`Across ${scope}.`}
          table={{ columns: ["Subject", "Entries", "Share"], rows: bySubject.map((d) => [d.label, d.value, share(d.value)]) }}
        >
          <BarList ariaLabel="Mistakes by subject" data={bySubject.map((d) => ({ ...d, display: `${d.value} · ${share(d.value)}` }))} />
        </ChartFrame>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ filter controls

function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-2">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg">
        {children}
      </select>
    </div>
  );
}

function DateField({ id, label, value, onChange, min, max }: { id: string; label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-2">
        {label}
      </label>
      <input id={id} type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg" />
    </div>
  );
}
