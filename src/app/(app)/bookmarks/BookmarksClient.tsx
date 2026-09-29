"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { BookmarkKind, BookmarkRow } from "@/lib/userdata/db";
import type { SubjectId } from "@/lib/content/schema";
import { useBookmarks } from "@/lib/userdata/hooks";
import { SUBJECT_SHORT } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookmarkCard, type BookmarkLookup } from "@/components/review/BookmarkCard";
import { StorageUnavailable, useOnline, useTableStatus } from "@/components/review/shared";

export interface BookmarkLibrary {
  subjects: { id: string; shortName: string }[];
  formulaSubject: Record<string, string>;
  conceptIds: string[];
  strategyIds: string[];
  availableMocks: string[];
}

type KindFilter = BookmarkKind | "all";
const KINDS: BookmarkKind[] = ["question", "concept", "formula", "strategy"];
const KIND_PLURAL: Record<BookmarkKind, string> = { question: "Questions", concept: "Concepts", formula: "Formulas", strategy: "Strategy" };
const KIND_NOUN: Record<BookmarkKind, string> = { question: "questions", concept: "concepts", formula: "formulas", strategy: "strategy articles" };
const PAGE = 50;

/** Rows can come from an imported backup file: skip anything that is not a well-formed bookmark. */
const isValid = (b: BookmarkRow) => KINDS.includes(b.kind) && typeof b.refId === "string" && typeof b.title === "string" && typeof b.createdAt === "string";

export function BookmarksClient({ library }: { library: BookmarkLibrary }) {
  const rows = useBookmarks();
  const status = useTableStatus("bookmarks", rows);
  const bookmarks = useMemo(() => rows.filter(isValid), [rows]);
  const online = useOnline();
  const [kind, setKind] = useState<KindFilter>("all");
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [notice, setNotice] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);
  const uid = useId();

  const lookup: BookmarkLookup = useMemo(
    () => ({
      formulaSubject: library.formulaSubject,
      formulaIds: new Set(Object.keys(library.formulaSubject)),
      conceptIds: new Set(library.conceptIds),
      strategyIds: new Set(library.strategyIds),
      availableMocks: new Set(library.availableMocks),
    }),
    [library],
  );

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return bookmarks.filter(
      (b) =>
        (kind === "all" || b.kind === kind) &&
        (!subject || b.subjectId === subject) &&
        terms.every((t) => `${b.title} ${b.note ?? ""}`.toLowerCase().includes(t)),
    );
  }, [bookmarks, kind, subject, query]);

  if (status === "unavailable") return <StorageUnavailable what="bookmarks" />;
  if (status === "loading") {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading your bookmarks…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[var(--radius)] bg-surface-2" />
        ))}
      </div>
    );
  }

  const offlineNote = !online ? (
    <Callout tone="warning" title="You are offline">
      Saved copies of your bookmarked questions are shown below where one was saved. Opening a page needs a connection.
    </Callout>
  ) : null;

  if (!bookmarks.length) {
    return (
      <div className="space-y-4">
        {offlineNote}
        <EmptyState
          title="You have no bookmarks yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/pyqs" variant="primary">
                Browse PYQs
              </ButtonLink>
              <ButtonLink href="/formulas">Open the formula book</ButtonLink>
            </div>
          }
        >
          Use the Bookmark button on a question (or on a concept, formula or strategy article) to save it here with your own note. Questions you bookmark from their question page
          also keep a copy of the question text that you can read offline.
        </EmptyState>
      </div>
    );
  }

  const kindCount = (k: KindFilter) => bookmarks.filter((b) => (k === "all" || b.kind === k) && (!subject || b.subjectId === subject)).length;
  const subjects = library.subjects
    .map((s) => ({ ...s, n: bookmarks.filter((b) => b.subjectId === s.id && (kind === "all" || b.kind === kind)).length }))
    .filter((s) => s.n > 0 || s.id === subject);
  const active = kind !== "all" || subject !== "" || query.trim() !== "";
  const reset = () => {
    setNotice("");
    setKind("all");
    setSubject("");
    setQuery("");
    setLimit(PAGE);
  };
  const shown = filtered.slice(0, limit);

  return (
    <div className="space-y-5">
      {offlineNote}

      <section aria-labelledby={`${uid}-filters`} className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
        <h2 id={`${uid}-filters`} className="sr-only">
          Filter bookmarks
        </h2>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-fg-2">Kind</legend>
          <div className="flex flex-wrap gap-2">
            {(["all", ...KINDS] as KindFilter[]).map((k) => (
              <label
                key={k}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-fg-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]"
              >
                <input
                  type="radio"
                  name={`${uid}-kind`}
                  value={k}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    setLimit(PAGE);
                  }}
                  className="sr-only"
                />
                {k === "all" ? "All" : KIND_PLURAL[k]}
                <span className="tnum text-xs text-fg-3">{kindCount(k)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor={`${uid}-subject`} className="mb-1 block text-xs font-medium text-fg-2">
              Subject
            </label>
            <select
              id={`${uid}-subject`}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setLimit(PAGE);
              }}
              className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {SUBJECT_SHORT[s.id as SubjectId] ?? s.shortName} ({s.n})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${uid}-q`} className="mb-1 block text-xs font-medium text-fg-2">
              Search titles and notes
            </label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
              <input
                id={`${uid}-q`}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="e.g. eigen, 2025"
                className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-3"
              />
            </div>
          </div>
          {active ? (
            <Button variant="ghost" className="h-10" onClick={reset}>
              Reset
            </Button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby={`${uid}-list`} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${uid}-list`} ref={listHeading} tabIndex={-1} className="text-lg font-semibold text-fg">
            {kind === "all" ? "Saved items" : KIND_PLURAL[kind]}
          </h2>
          <p role="status" aria-live="polite" className="text-sm text-fg-3">
            {notice ? <span className="sr-only">{notice} </span> : null}
            {filtered.length === bookmarks.length ? `${plural(bookmarks.length, "bookmark")}, newest first` : `${filtered.length} of ${plural(bookmarks.length, "bookmark")}`}
          </p>
        </div>
        {filtered.length ? (
          <ul className="space-y-3">
            {shown.map((b) => (
              <BookmarkCard
                key={b.key}
                bookmark={b}
                lookup={lookup}
                online={online}
                onRemoved={(title) => {
                  setNotice(`Removed the bookmark “${title}”.`);
                  requestAnimationFrame(() => listHeading.current?.focus());
                }}
              />
            ))}
          </ul>
        ) : (
          <EmptyState title="No bookmarks match" action={<Button onClick={reset}>Show all bookmarks</Button>}>
            {kind !== "all" && kindCount(kind) === 0
              ? `You have not bookmarked any ${KIND_NOUN[kind]} ${subject ? "in this subject " : ""}yet.`
              : "Try another subject or a shorter search."}
          </EmptyState>
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
