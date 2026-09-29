"use client";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER } from "@/lib/labels";
import { formatDate, cn } from "@/lib/utils";
import { slotName, type PaperInfo, type TaxonomySubject } from "./data";
import { MARKS, STATUSES, STATUS_LABEL, TYPES, type BrowseFilters } from "./filters";

export type FacetName = "year" | "paper" | "subject" | "topic" | "subtopic" | "difficulty" | "type" | "marks" | "status";
/** Per facet: value → number of questions matching every other active filter; "*" is the facet's "All" count. */
export type Facets = Record<FacetName, Map<string, number>>;

/** Native select with a visible label and a ≥ 40px touch target. */
function FilterSelect({ id, label, hint, children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; hint?: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-2">
        {label}
      </label>
      <select
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-3"
        {...props}
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

const withCount = (label: string, n: number | undefined) => `${label} (${n ?? 0})`;

export function FilterControls({
  idPrefix,
  filters,
  onChange,
  taxonomy,
  papers,
  facets,
  topicSubject,
}: {
  idPrefix: string;
  filters: BrowseFilters;
  onChange: (patch: Partial<BrowseFilters>) => void;
  taxonomy: TaxonomySubject[];
  papers: PaperInfo[];
  facets: Facets;
  topicSubject: Map<string, string>;
}) {
  const id = (k: string) => `${idPrefix}-pyq-${k}`;
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a);
  const visiblePapers = filters.year ? papers.filter((p) => String(p.year) === filters.year) : papers;
  const subject = taxonomy.find((s) => s.id === filters.subject);
  const topic = subject?.topics.find((t) => t.id === filters.topic);
  const f = facets;

  return (
    <div className="space-y-4">
      <FilterSelect id={id("subject")} label="Subject" value={filters.subject} onChange={(e) => {
        const v = e.target.value;
        onChange({ subject: v, topic: v && topicSubject.get(filters.topic) === v ? filters.topic : "", subtopic: v && topicSubject.get(filters.topic) === v ? filters.subtopic : "" });
      }}>
        <option value="">{withCount("All subjects", f.subject.get("*"))}</option>
        {taxonomy.map((s) => (
          <option key={s.id} value={s.id}>
            {withCount(s.name, f.subject.get(s.id))}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        id={id("topic")}
        label="Topic"
        value={filters.topic}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ topic: v, subtopic: "", subject: v ? (topicSubject.get(v) ?? filters.subject) : filters.subject });
        }}
      >
        <option value="">{withCount(subject ? `All ${subject.shortName} topics` : "All topics", f.topic.get("*"))}</option>
        {subject
          ? subject.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {withCount(t.name, f.topic.get(t.id))}
              </option>
            ))
          : taxonomy.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {withCount(t.name, f.topic.get(t.id))}
                  </option>
                ))}
              </optgroup>
            ))}
      </FilterSelect>

      <FilterSelect id={id("subtopic")} label="Subtopic" value={filters.subtopic} disabled={!topic} onChange={(e) => onChange({ subtopic: e.target.value })}>
        {topic ? (
          <>
            <option value="">{withCount("All subtopics", f.subtopic.get("*"))}</option>
            {topic.subtopics.map((st) => (
              <option key={st.id} value={st.id}>
                {withCount(st.name, f.subtopic.get(st.id))}
              </option>
            ))}
          </>
        ) : (
          <option value="">Choose a topic first</option>
        )}
      </FilterSelect>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <FilterSelect id={id("year")} label="Year" value={filters.year} onChange={(e) => onChange({ year: e.target.value })}>
          <option value="">{withCount("All years", f.year.get("*"))}</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {withCount(String(y), f.year.get(String(y)))}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id={id("paper")} label="Paper (date · session · slot)" value={filters.paper} onChange={(e) => onChange({ paper: e.target.value })}>
          <option value="">{withCount(filters.year ? `All ${filters.year} papers` : "All papers", f.paper.get("*"))}</option>
          {visiblePapers.map((p) => (
            <option key={p.id} value={p.id}>
              {withCount(`${p.year} · ${formatDate(p.examDate)} · S${p.session} · ${slotName(p.slot)}`, f.paper.get(p.id))}
            </option>
          ))}
        </FilterSelect>
      </div>

      <FilterSelect
        id={id("difficulty")}
        label="Difficulty (platform-estimated)"
        value={filters.difficulty}
        onChange={(e) => onChange({ difficulty: e.target.value as BrowseFilters["difficulty"] })}
      >
        <option value="">{withCount("Any difficulty", f.difficulty.get("*"))}</option>
        {DIFFICULTY_ORDER.map((d) => (
          <option key={d} value={d}>
            {withCount(DIFFICULTY_LABEL[d], f.difficulty.get(d))}
          </option>
        ))}
      </FilterSelect>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <FilterSelect id={id("type")} label="Question type" value={filters.type} onChange={(e) => onChange({ type: e.target.value as BrowseFilters["type"] })}>
          <option value="">{withCount("Any type", f.type.get("*"))}</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {withCount(t, f.type.get(t))}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id={id("marks")} label="Marks" value={filters.marks} onChange={(e) => onChange({ marks: e.target.value as BrowseFilters["marks"] })}>
          <option value="">{withCount("Any", f.marks.get("*"))}</option>
          {MARKS.map((m) => (
            <option key={m} value={m}>
              {withCount(m === "1" ? "1 mark" : `${m} marks`, f.marks.get(m))}
            </option>
          ))}
        </FilterSelect>
      </div>

      <FilterSelect
        id={id("status")}
        label="Your status"
        value={filters.status}
        hint="Solved / incorrect use your latest attempt at each question."
        onChange={(e) => onChange({ status: e.target.value as BrowseFilters["status"] })}
      >
        <option value="">{withCount("All questions", f.status.get("*"))}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {withCount(STATUS_LABEL[s], f.status.get(s))}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
