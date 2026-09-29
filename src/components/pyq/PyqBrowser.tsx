"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dumbbell, Search, SlidersHorizontal, X } from "lucide-react";
import type { QuestionMeta } from "@/lib/content/types";
import { useBookmarkKeys, useQuestionStatuses } from "@/lib/userdata/hooks";
import { bookmarkKey } from "@/lib/userdata/ops";
import { DIFFICULTY_LABEL, SUBJECT_SHORT } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { marksLabel, pyqTitle, slotName, type PaperInfo, type TaxonomySubject } from "./data";
import {
  DEFAULT_FILTERS,
  FILTER_KEYS,
  SORTS,
  SORT_LABEL,
  STATUS_LABEL,
  activeFilterCount,
  buildFilterContext,
  buildGroupLookups,
  buildResults,
  facetCounts,
  filtersToQuery,
  normalizeFilters,
  parseFilters,
  parseSearch,
  rowMatches,
  statusKeysOf,
  symbolWords,
  type BrowseFilters,
  type FilterKey,
  type RowFacts,
  type SortKey,
} from "./filters";
import { FilterControls, type Facets } from "./FilterControls";
import { PyqRow } from "./PyqRow";
import { isAttempted, pyqState } from "./status";
import { useAttemptsLoaded } from "./useAttemptsLoaded";
import { rememberListAnchor, useStoreNavList } from "./useNavList";
import { VirtualResults } from "./VirtualResults";

const PRACTICE_LIMIT = 50;

export interface PyqBrowserProps {
  rows: QuestionMeta[];
  papers: PaperInfo[];
  taxonomy: TaxonomySubject[];
}

export function PyqBrowser({ rows, papers, taxonomy }: PyqBrowserProps) {
  const ctx = useMemo(() => buildFilterContext(taxonomy, papers), [taxonomy, papers]);
  const look = useMemo(() => buildGroupLookups(taxonomy, papers), [taxonomy, papers]);
  // The URL is the source of truth when the browser mounts. Filter changes rewrite it with
  // replaceState, so after Back from a question the router may restore this page's original
  // server props while the address bar holds the latest filters; useSearchParams has the latter.
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<BrowseFilters>(() => parseFilters(searchParams, ctx));
  const [sheetOpen, setSheetOpen] = useState(false);
  const statuses = useQuestionStatuses();
  const bookmarks = useBookmarkKeys();
  const progress = useAttemptsLoaded();
  const storeNavList = useStoreNavList();
  const listTop = useRef(0);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const onListTop = useCallback((top: number) => {
    listTop.current = top;
  }, []);

  // ---------------------------------------------------------------- derived data
  const haystacks = useMemo(() => {
    const subtopicName = new Map<string, string>();
    for (const s of taxonomy) for (const t of s.topics) for (const st of t.subtopics) subtopicName.set(st.id, st.name);
    return new Map(
      rows.map((m) => [
        m.id,
        [
          m.preview,
          symbolWords(m.preview),
          look.topicName.get(m.topicId),
          ...m.subtopicIds.map((id) => subtopicName.get(id)),
          look.subjectName.get(m.subjectId),
          SUBJECT_SHORT[m.subjectId],
          m.year,
          m.type,
          m.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      ]),
    );
  }, [rows, taxonomy, look]);

  const facts = useMemo(
    () =>
      new Map<string, RowFacts>(
        rows.map((m) => [m.id, { state: pyqState(statuses.get(m.id)), bookmarked: bookmarks.has(bookmarkKey("question", m.id)), haystack: haystacks.get(m.id) ?? "" }]),
      ),
    [rows, statuses, bookmarks, haystacks],
  );

  const tokens = useMemo(() => parseSearch(filters.q), [filters.q]);
  const filtered = useMemo(() => rows.filter((m) => rowMatches(m, filters, tokens, facts.get(m.id)!)), [rows, filters, tokens, facts]);
  const results = useMemo(() => buildResults(filtered, filters.sort, look), [filtered, filters.sort, look]);
  const marks = useMemo(() => filtered.reduce((a, m) => a + m.marks, 0), [filtered]);

  const facets: Facets = useMemo(() => {
    const fc = (skip: FilterKey[], values: (m: QuestionMeta, r: RowFacts) => string | string[]) =>
      facetCounts(rows, facts, filters, tokens, skip, (m, r) => ["*", ...[values(m, r)].flat()]);
    return {
      subject: fc(["subject", "topic", "subtopic"], (m) => m.subjectId),
      topic: fc(["topic", "subtopic"], (m) => m.topicId),
      subtopic: fc(["subtopic"], (m) => m.subtopicIds),
      year: fc(["year", "paper"], (m) => String(m.year)),
      paper: fc(["paper"], (m) => m.paperId ?? ""),
      difficulty: fc(["difficulty"], (m) => m.difficulty),
      type: fc(["type"], (m) => m.type),
      marks: fc(["marks"], (m) => String(m.marks)),
      status: fc(["status"], (_m, r) => statusKeysOf(r)),
    };
  }, [rows, facts, filters, tokens]);

  const attemptedAny = useMemo(() => rows.some((m) => isAttempted(facts.get(m.id)!.state)), [rows, facts]);
  const bookmarkedAny = useMemo(() => rows.some((m) => facts.get(m.id)!.bookmarked), [rows, facts]);

  // ---------------------------------------------------------------- updates
  const scrollToResults = () => {
    const top = listTop.current;
    if (top && window.scrollY > top - 96) window.scrollTo({ top: Math.max(0, top - 150) });
  };

  const apply = (next: BrowseFilters, opts: { scroll?: boolean } = {}) => {
    setFilters(next);
    const qs = filtersToQuery(next);
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    if (opts.scroll !== false && !sheetOpen) scrollToResults();
  };
  const update = (patch: Partial<BrowseFilters>) => apply(normalizeFilters({ ...filters, ...patch }, ctx));
  // The shared Dialog returns focus only to a Radix trigger, so hand it back to the Filters button here.
  const closeSheet = () => {
    setSheetOpen(false);
    requestAnimationFrame(() => {
      filtersButton.current?.focus({ preventScroll: true });
      scrollToResults();
    });
  };
  const clearFilters = () => apply({ ...DEFAULT_FILTERS, sort: filters.sort });

  const removeFilter = (k: FilterKey) => {
    if (k === "subject") update({ subject: "", topic: "", subtopic: "" });
    else if (k === "topic") update({ topic: "", subtopic: "" });
    else update({ [k]: "" } as Partial<BrowseFilters>);
  };

  const chipLabel = (k: FilterKey): string => {
    switch (k) {
      case "subject":
        return `Subject: ${look.subjectName.get(filters.subject) ?? filters.subject}`;
      case "topic":
        return `Topic: ${look.topicName.get(filters.topic) ?? filters.topic}`;
      case "subtopic": {
        const st = taxonomy.flatMap((s) => s.topics.flatMap((t) => t.subtopics)).find((x) => x.id === filters.subtopic);
        return `Subtopic: ${st?.name ?? filters.subtopic}`;
      }
      case "year":
        return `Year: ${filters.year}`;
      case "paper": {
        const p = look.paperById.get(filters.paper);
        return p ? `Paper: ${formatDate(p.examDate)} · S${p.session}` : `Paper: ${filters.paper}`;
      }
      case "difficulty":
        return `Difficulty: ${filters.difficulty ? DIFFICULTY_LABEL[filters.difficulty] : ""}`;
      case "type":
        return `Type: ${filters.type}`;
      case "marks":
        return `Marks: ${filters.marks}`;
      case "status":
        return `Status: ${filters.status ? STATUS_LABEL[filters.status] : ""}`;
      case "q":
        return `Search: “${filters.q.trim()}”`;
    }
  };

  const activeKeys = FILTER_KEYS.filter((k) => (k === "q" ? filters.q.trim() : filters[k]));
  const activeCount = activeFilterCount(filters);
  const practiceIds = results.orderedIds.slice(0, PRACTICE_LIMIT);
  const practiceHref = `/practice?ids=${practiceIds.join(",")}&from=pyqs`;

  const renderRow = (m: QuestionMeta, isLast: boolean) => (
    <PyqRow
      meta={m}
      topicName={look.topicName.get(m.topicId) ?? m.topicId}
      subjectLabel={SUBJECT_SHORT[m.subjectId]}
      state={facts.get(m.id)?.state ?? "unattempted"}
      paperText={`${m.year} · ${formatDate(m.examDate)} · ${slotName(m.slot ?? "")}`}
      onNavigate={() => {
        storeNavList(results.orderedIds);
        rememberListAnchor(m.id);
      }}
      className={isLast ? "border-b-0" : undefined}
      trailing={<BookmarkButton kind="question" refId={m.id} title={pyqTitle(m)} subjectId={m.subjectId} compact className="h-10 w-10 justify-center px-0" />}
    />
  );

  const controls = (prefix: string) => (
    <FilterControls idPrefix={prefix} filters={filters} onChange={update} taxonomy={taxonomy} papers={papers} facets={facets} topicSubject={ctx.topicSubject} />
  );

  if (!rows.length) {
    return (
      <EmptyState title="No official PYQs are in the question bank yet" action={<ButtonLink href="/pyqs">Back to PYQs</ButtonLink>}>
        Questions from the official GATE DA papers appear here, with filters, as soon as they are added to the question bank.
      </EmptyState>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* ------------------------------------------------ desktop filter column */}
      <aside aria-labelledby="pyq-filters-h" className="hidden lg:sticky lg:top-[4.5rem] lg:block lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:rounded-[var(--radius)] lg:border lg:border-border lg:bg-surface lg:p-4">
        <form role="search" aria-labelledby="pyq-filters-h" onSubmit={(e) => e.preventDefault()}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="pyq-filters-h" className="text-sm font-semibold text-fg">
              Filters
            </h2>
            {activeCount ? (
              <button type="button" onClick={clearFilters} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-accent-text hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>
          {controls("d")}
        </form>
      </aside>

      {/* ------------------------------------------------ results */}
      <section aria-labelledby="pyq-results-h" className="min-w-0">
        <h2 id="pyq-results-h" className="sr-only">
          Results
        </h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="pyq-search" className="sr-only">
                Search PYQs by text, topic, year or question number
              </label>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
              <input
                id="pyq-search"
                type="search"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Search text or Q12"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-3"
              />
            </div>
            <Button ref={filtersButton} className="lg:hidden" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" />
              Filters
              {activeCount ? <span className="tnum rounded-full bg-accent-soft px-1.5 text-xs font-semibold text-accent-text">{activeCount}</span> : null}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p role="status" aria-live="polite" className="text-sm text-fg-2">
              <span className="tnum font-semibold text-fg">{filtered.length}</span> of <span className="tnum">{rows.length}</span> questions
              <span className="text-fg-3"> · {marksLabel(marks)}</span>
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="pyq-sort" className="text-sm text-fg-3">
                Sort
              </label>
              <select
                id="pyq-sort"
                value={filters.sort}
                onChange={(e) => apply({ ...filters, sort: e.target.value as SortKey })}
                className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
              {practiceIds.length ? (
                <ButtonLink href={practiceHref} variant="primary" title={results.orderedIds.length > PRACTICE_LIMIT ? `Practise the first ${PRACTICE_LIMIT} of these questions, in this order` : "Practise these questions in this order"}>
                  <Dumbbell aria-hidden className="h-4 w-4" />
                  {results.orderedIds.length > PRACTICE_LIMIT ? `Practice first ${PRACTICE_LIMIT}` : "Practice these"}
                </ButtonLink>
              ) : (
                <Button variant="primary" disabled>
                  <Dumbbell aria-hidden className="h-4 w-4" /> Practice these
                </Button>
              )}
            </div>
          </div>

          {activeKeys.length ? (
            <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
              {activeKeys.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => removeFilter(k)}
                    aria-label={`Remove filter ${chipLabel(k)}`}
                    className="inline-flex h-8 max-w-[20rem] items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-2 text-xs font-medium text-fg-2 hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="truncate">{chipLabel(k)}</span>
                    <X aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-3" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clearFilters} className="h-8 rounded-full px-2 text-xs font-medium text-accent-text hover:underline">
                  Clear filters
                </button>
              </li>
            </ul>
          ) : null}
        </div>

        <div className="mt-4">
          {filtered.length ? (
            <VirtualResults items={results.items} groups={results.groups} renderRow={renderRow} onTop={onListTop} />
          ) : (
            <NoResults
              filters={filters}
              progress={progress}
              attemptedAny={attemptedAny}
              bookmarkedAny={bookmarkedAny}
              onClear={clearFilters}
              onShowAll={() => update({ status: "" })}
            />
          )}
        </div>
        {filtered.length ? (
          <p className="mt-3 text-xs text-fg-3">
            Difficulty is platform-estimated; GATE does not publish difficulty levels. Question status comes only from your own attempts on this device.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------ mobile filter sheet */}
      <Dialog
        open={sheetOpen}
        onOpenChange={(o) => (o ? setSheetOpen(true) : closeSheet())}
        title="Filter PYQs"
        className="bottom-0 left-0 top-auto max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none pb-0 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2"
      >
        <form
          role="search"
          aria-label="PYQ filters"
          onSubmit={(e) => {
            e.preventDefault();
            closeSheet();
          }}
        >
          {controls("m")}
          <div className="sticky bottom-0 -mx-5 mt-5 flex items-center gap-2 border-t border-border bg-surface px-5 py-3">
            <Button onClick={clearFilters} disabled={!activeCount}>
              Clear filters
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Done · show {filtered.length} {filtered.length === 1 ? "question" : "questions"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function NoResults({
  filters,
  progress,
  attemptedAny,
  bookmarkedAny,
  onClear,
  onShowAll,
}: {
  filters: BrowseFilters;
  progress: ReturnType<typeof useAttemptsLoaded>;
  attemptedAny: boolean;
  bookmarkedAny: boolean;
  onClear: () => void;
  onShowAll: () => void;
}) {
  const others = activeFilterCount({ ...filters, status: "" });
  if (filters.status && progress === "loading") {
    return <EmptyState title="Loading your progress…">Your attempts and bookmarks on this device are being read; the status filter applies as soon as they load.</EmptyState>;
  }
  if (filters.status && progress === "unavailable") {
    return (
      <EmptyState title="Your status is not available in this browser" action={<Button onClick={onShowAll}>Show all questions</Button>}>
        This browser is blocking local storage (for example in a private window), so attempts and bookmarks cannot be saved or filtered here.
      </EmptyState>
    );
  }
  if (filters.status === "bookmarked" && !bookmarkedAny) {
    return (
      <EmptyState title="You have not bookmarked any PYQs yet" action={<Button onClick={onShowAll}>Show all questions</Button>}>
        Use the bookmark button on any question (here or on the question page) to collect questions you want to revisit. They will be listed under this filter.
      </EmptyState>
    );
  }
  if ((filters.status === "attempted" || filters.status === "correct" || filters.status === "incorrect") && !attemptedAny) {
    return (
      <EmptyState title="You have not attempted any PYQs yet" action={<Button onClick={onShowAll}>Show all questions</Button>}>
        Open a question and submit an answer. Your latest result on each question then appears here, and this filter starts working.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      title="No questions match these filters"
      action={
        <Button variant="primary" onClick={onClear}>
          Clear filters
        </Button>
      }
    >
      {filters.q.trim()
        ? "Check the spelling, try fewer words, or search for a question number such as “Q12”."
        : others > 1
          ? "Remove one of the active filters above to widen the results."
          : filters.status
            ? `No questions are ${STATUS_LABEL[filters.status].toLowerCase()} with the other filters applied.`
            : "Try a different value for this filter."}
    </EmptyState>
  );
}

