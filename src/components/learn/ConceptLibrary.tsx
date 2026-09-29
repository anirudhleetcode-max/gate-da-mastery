"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import { SUBJECT_COLOR } from "@/lib/labels";
import { plural } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import type { ConceptListItem, LibrarySubject } from "./types";
import { SUPPORTING_LABEL, libraryQuery, parseLibraryFilters, type LibraryFilters } from "./library";

function Dot({ id }: { id: SubjectId }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[id] }} />;
}

export function ConceptLibrary({ subjects, concepts }: { subjects: LibrarySubject[]; concepts: ConceptListItem[] }) {
  const subjectIds = useMemo(() => new Set(subjects.map((s) => s.id as string)), [subjects]);
  // The address bar is the source of truth on mount (it also survives Back from a concept page).
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<LibraryFilters>(() => parseLibraryFilters((k) => searchParams.get(k), subjectIds));

  const apply = (next: LibraryFilters) => {
    setFilters(next);
    const qs = libraryQuery(next);
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const tokens = useMemo(
    () =>
      filters.q
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    [filters.q],
  );
  const matches = useMemo(
    () => concepts.filter((c) => (!filters.subject || c.subjectId === filters.subject) && tokens.every((t) => c.haystack.includes(t))),
    [concepts, filters.subject, tokens],
  );
  const bySubject = useMemo(() => {
    const m = new Map<string, ConceptListItem[]>();
    for (const c of matches) (m.get(c.subjectId) ?? m.set(c.subjectId, []).get(c.subjectId)!).push(c);
    return m;
  }, [matches]);
  const countBySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of concepts) m.set(c.subjectId, (m.get(c.subjectId) ?? 0) + 1);
    return m;
  }, [concepts]);

  const searching = tokens.length > 0;
  const visibleSubjects = subjects.filter((s) => (!filters.subject || s.id === filters.subject) && (!searching || bySubject.has(s.id)));
  const subjectName = subjects.find((s) => s.id === filters.subject)?.name;

  if (!concepts.length) {
    return (
      <div className="space-y-6">
        <EmptyState title="The concept library has no notes yet">
          Concept notes are added subject by subject. Until a subject has them, its formula book entries and its official PYQs (each with a full worked solution) cover the same
          ideas.
        </EmptyState>
        <ul className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.id}>
              <SubjectEmpty subject={s} headingLevel="h2" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div role="search" aria-label="Filter concepts" className="grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:p-4">
        <Select label="Subject" id="concept-subject" value={filters.subject} onChange={(e) => apply({ ...filters, subject: e.target.value })}>
          <option value="">All subjects ({concepts.length})</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({countBySubject.get(s.id) ?? 0})
            </option>
          ))}
        </Select>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="concept-q" className="text-xs font-medium text-fg-3">
            Quick filter
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
            <input
              id="concept-q"
              type="search"
              value={filters.q}
              onChange={(e) => apply({ ...filters, q: e.target.value })}
              placeholder="e.g. Bayes, eigenvalue, normal form"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface pl-8 pr-10 text-sm text-fg placeholder:text-fg-3 sm:h-9"
            />
            {filters.q ? (
              <button
                type="button"
                onClick={() => apply({ ...filters, q: "" })}
                className="absolute right-0.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg sm:h-8 sm:w-8"
                aria-label="Clear the quick filter"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p role="status" className="text-sm text-fg-2">
        {searching || filters.subject ? (
          <>
            Showing <span className="tnum font-semibold text-fg">{matches.length}</span> of <span className="tnum">{plural(concepts.length, "concept")}</span>
            {subjectName ? <> in {subjectName}</> : null}
            {searching ? <> matching &ldquo;{filters.q.trim()}&rdquo;</> : null}.
          </>
        ) : (
          <>
            <span className="tnum font-semibold text-fg">{plural(concepts.length, "concept note")}</span> across {plural(new Set(concepts.map((c) => c.subjectId)).size, "subject")}
            , grouped by subject and topic.
          </>
        )}
      </p>

      {!filters.subject && !searching ? (
        <nav aria-label="Jump to a subject" className="hidden sm:block">
          <ul className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <a href={`#subject-${s.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg sm:min-h-8">
                  <Dot id={s.id} />
                  {s.name}
                  <span className="tnum text-xs text-fg-3">{countBySubject.get(s.id) ?? 0}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {searching && !matches.length ? (
        <EmptyState
          title={`No concepts match “${filters.q.trim()}”${subjectName ? ` in ${subjectName}` : ""}`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => apply({ ...filters, q: "" })}>Clear the quick filter</Button>
              {filters.subject ? <Button onClick={() => apply({ subject: "", q: filters.q })}>Search all subjects</Button> : null}
            </div>
          }
        >
          The filter looks for every word in concept titles, topics, syllabus phrases and definitions. Try fewer or shorter words, or use the site search for questions and formulas.
        </EmptyState>
      ) : null}

      {visibleSubjects.map((s) => (
        <SubjectSection key={s.id} subject={s} concepts={bySubject.get(s.id) ?? []} searching={searching} />
      ))}
    </div>
  );
}

/** Honest empty state for a subject without notes; `headingLevel` only when no section heading names the subject already. */
function SubjectEmpty({ subject: s, headingLevel: H }: { subject: LibrarySubject; headingLevel?: "h2" | "h3" }) {
  return (
    <div className="h-full rounded-[var(--radius)] border border-dashed border-border-strong bg-surface px-4 py-3">
      {H ? (
        <H className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
          <Dot id={s.id} />
          {s.name}
        </H>
      ) : null}
      <p className="text-sm text-fg-3">No concept notes for {s.name} yet.</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {s.formulaCount ? (
          <li>
            <Link href={`/formulas/${s.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
              Formula book ({plural(s.formulaCount, "formula")})
            </Link>
          </li>
        ) : null}
        <li>
          <Link href={`/subjects/${s.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
            {s.pyqCount ? `Subject page (${plural(s.pyqCount, "official PYQ")})` : "Subject page"}
          </Link>
        </li>
      </ul>
    </div>
  );
}

function SubjectSection({ subject: s, concepts, searching }: { subject: LibrarySubject; concepts: ConceptListItem[]; searching: boolean }) {
  const headingId = `subject-${s.id}-h`;
  const topics = s.topics.map((t) => ({ ...t, items: concepts.filter((c) => c.topicId === t.id) }));
  const withNotes = topics.filter((t) => t.items.length);
  const without = topics.filter((t) => !t.items.length);
  return (
    <section id={`subject-${s.id}`} aria-labelledby={headingId} className="scroll-mt-20 space-y-3">
      <h2 id={headingId} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border pb-2 text-lg font-semibold text-fg">
        <Dot id={s.id} />
        {s.name}
        <span className="tnum text-sm font-normal text-fg-3">{concepts.length ? plural(concepts.length, searching ? "match" : "concept", searching ? "matches" : undefined) : ""}</span>
      </h2>
      {!concepts.length ? (
        <SubjectEmpty subject={s} />
      ) : (
        <>
          {withNotes.map((t) => (
            <div key={t.id} id={`topic-${t.id}`} className="scroll-mt-20">
              <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-fg-2">
                {t.name}
                <span className="tnum text-xs font-normal text-fg-3">{t.items.length}</span>
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {t.items.map((c) => (
                  <li key={c.id}>
                    <ConceptCard c={c} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!searching && without.length ? (
            <p className="text-sm text-fg-3">
              <span className="font-medium text-fg-2">No notes yet for:</span> {without.map((t) => t.name).join(", ")}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function ConceptCard({ c }: { c: ConceptListItem }) {
  return (
    <div className="relative flex h-full flex-col rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-2">
      <Link
        href={`/concepts/${c.id}`}
        className="font-medium text-fg after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--focus)]"
      >
        {c.title}
      </Link>
      {c.summary ? <p className="mt-0.5 line-clamp-2 text-sm text-fg-3">{c.summary}</p> : null}
      <p className="tnum mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1.5 text-xs text-fg-3">
        <span>{c.pyqCount ? plural(c.pyqCount, "official PYQ") : "No official PYQs linked"}</span>
        <span>{plural(c.formulaCount, "formula")}</span>
      </p>
      {c.supporting ? (
        <Badge tone="neutral" className="mt-1.5 self-start whitespace-normal">
          {SUPPORTING_LABEL}
        </Badge>
      ) : null}
    </div>
  );
}
