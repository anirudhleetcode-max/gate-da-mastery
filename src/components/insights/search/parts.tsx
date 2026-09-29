/** Search page building blocks (server-compatible; text-only highlighting). */
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import type { SearchDoc } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { highlightSegments } from "./highlight";

export type Category = Exclude<SearchDoc["category"], "mock">;

/** Display order and labels of the result groups. */
export const CATEGORIES: { id: Category; label: string; singular: string; plural: string }[] = [
  { id: "pyq", label: "PYQs", singular: "PYQ", plural: "PYQs" },
  { id: "concept", label: "Concepts", singular: "concept", plural: "concepts" },
  { id: "formula", label: "Formulas", singular: "formula", plural: "formulas" },
  { id: "topic", label: "Topics", singular: "topic", plural: "topics" },
  { id: "subject", label: "Subjects", singular: "subject", plural: "subjects" },
  { id: "strategy", label: "Strategy", singular: "strategy article", plural: "strategy articles" },
  { id: "practice", label: "Practice", singular: "practice question", plural: "practice questions" },
];

export function isCategory(v: string | undefined): v is Category {
  return CATEGORIES.some((c) => c.id === v);
}

/** Query terms wrapped in <mark>, rendered as React text (never as HTML). */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-[2px] bg-warning-soft font-semibold text-fg">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function SearchForm({ q }: { q: string }) {
  return (
    <Form action="/search" role="search" aria-label="Search the platform" className="flex flex-col gap-1.5">
      <label htmlFor="search-q" className="text-sm font-medium text-fg">
        Search PYQs, concepts, formulas, topics and strategy
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <input
            key={q}
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            minLength={2}
            maxLength={120}
            required
            placeholder="e.g. eigenvalues, 2025 Q36, SQL join"
            aria-describedby="search-help"
            className="h-11 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-[0.95rem] text-fg placeholder:text-fg-3"
          />
        </div>
        <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover dark:text-[#0e1117]">
          Search
        </button>
      </div>
      <p id="search-help" className="text-xs text-fg-3">
        At least 2 characters. Matches words and prefixes and tolerates small typos. Mock-test questions are never searchable.
      </p>
    </Form>
  );
}

export function CategoryChips({ q, counts, active }: { q: string; counts: Record<Category, number>; active?: Category }) {
  const total = CATEGORIES.reduce((a, c) => a + counts[c.id], 0);
  const href = (cat?: Category) => `/search?q=${encodeURIComponent(q)}${cat ? `&cat=${cat}` : ""}`;
  const chip = "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium";
  return (
    <nav aria-label="Filter results by category" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex gap-2 sm:flex-wrap">
        <li>
          <Link href={href()} aria-current={!active ? "page" : undefined} className={cn(chip, !active ? "border-accent bg-accent-soft text-accent-text" : "border-border text-fg-2 hover:bg-surface-2")}>
            All <span className="tnum text-xs">{total}</span>
          </Link>
        </li>
        {CATEGORIES.filter((c) => counts[c.id] > 0).map((c) => (
          <li key={c.id}>
            <Link href={href(c.id)} aria-current={active === c.id ? "page" : undefined} className={cn(chip, active === c.id ? "border-accent bg-accent-soft text-accent-text" : "border-border text-fg-2 hover:bg-surface-2")}>
              {c.label} <span className="tnum text-xs">{counts[c.id]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
