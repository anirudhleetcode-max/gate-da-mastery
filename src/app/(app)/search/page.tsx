import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { getConcept, getFormula, getPapers, getQuestion, getStrategyArticle, getSubject, getSubjects, getTopic, searchContent } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { OriginBadge } from "@/components/question/badges";
import { CATEGORIES, CategoryChips, Highlight, SearchForm, isCategory, type Category } from "@/components/insights/search/parts";
import { excerpt, queryTerms } from "@/components/insights/search/highlight";
import { stemPreview } from "@/components/pyq/preview";
import { SUBJECT_SHORT } from "@/lib/labels";
import type { SubjectId } from "@/lib/content/schema";
import { plural } from "@/lib/utils";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const q = one((await searchParams).q).trim().slice(0, 80);
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false } };
}

interface Hit {
  id: string;
  category: Category;
  title: string;
  href: string;
  subjectId?: string;
  /** The id without its category prefix ("formula:f-la-x" → "f-la-x"). */
  key: string;
  origin?: "OFFICIAL_PYQ" | "ORIGINAL_PRACTICE";
}

const PREVIEW_PER_GROUP = 6;

/**
 * Search results with the availability gate re-applied to question hits. When
 * the query names a year ("2025", "2026 Q14"), PYQ hits are limited to that
 * year: the fuzzy matcher would otherwise also accept neighbouring years,
 * which differ by one digit (and a year with no paper then finds no PYQs).
 */
function runSearch(q: string, terms: string[]): Hit[] {
  const wantedYears = new Set(terms.filter((t) => /^(19|20)\d{2}$/.test(t)).map(Number));
  const hits: Hit[] = [];
  for (const r of searchContent(q, 400)) {
    if (!isCategory(r.category)) continue; // mock-test entries are never shown here
    const key = r.id.includes(":") ? r.id.slice(r.id.indexOf(":") + 1) : r.id;
    let origin: Hit["origin"];
    if (r.category === "pyq" || r.category === "practice") {
      const question = getQuestion(r.id);
      if (!question || question.origin === "MOCK_TEST") continue;
      if (question.origin === "OFFICIAL_PYQ" && wantedYears.size && !wantedYears.has(question.year ?? 0)) continue;
      origin = question.origin;
    }
    hits.push({ id: r.id, category: r.category, title: r.title, href: r.href, subjectId: r.subjectId, key, origin });
  }
  return hits;
}

/** Readable excerpt and metadata of one hit (computed only for the hits that are shown). Math is converted to Unicode text. */
function describe(h: Hit, terms: string[]): { snippet: string; meta: string[] } {
  const subject = h.subjectId ? SUBJECT_SHORT[h.subjectId as SubjectId] : undefined;
  const meta: string[] = [];
  let text = "";
  switch (h.category) {
    case "pyq":
    case "practice": {
      const question = getQuestion(h.id);
      if (question) {
        text = stemPreview(question.html.stem, 1200);
        if (subject) meta.push(subject);
        meta.push(`${question.type} · ${plural(question.marks, "mark")}`);
      }
      break;
    }
    case "concept": {
      const c = getConcept(h.key);
      text = c ? stemPreview(`${c.html.definition} ${c.html.intuition}`, 1200) : "";
      if (subject) meta.push(subject);
      break;
    }
    case "formula": {
      const f = getFormula(h.key);
      text = f ? stemPreview(f.html.meaning, 1200) : "";
      if (subject) meta.push(subject);
      break;
    }
    case "topic": {
      const t = getTopic(h.key);
      text = t ? `${t.summary} Subtopics: ${t.subtopics.map((s) => s.name).join(", ")}.` : "";
      if (subject) meta.push(subject);
      if (t) meta.push(plural(t.subtopics.length, "subtopic"));
      break;
    }
    case "subject":
      text = getSubject(h.key)?.description ?? "";
      break;
    case "strategy":
      text = getStrategyArticle(h.key)?.summary ?? "";
      break;
  }
  return { snippet: excerpt(text, terms, 190), meta };
}

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 120);
  const catParam = one(sp.cat);
  const active = isCategory(catParam) ? catParam : undefined;
  const terms = queryTerms(q);
  const tooShort = q.length > 0 && q.length < 2;
  const years = [...new Set(getPapers().map((p) => p.year))].sort((a, b) => b - a);
  const hits = q.length >= 2 ? runSearch(q, terms) : [];
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, hits.filter((h) => h.category === c.id).length])) as Record<Category, number>;
  const groups = CATEGORIES.filter((c) => counts[c.id] > 0 && (!active || active === c.id));

  // Suggestions built from real content, so every one of them returns results.
  const topicSuggestions = getSubjects()
    .filter((s) => s.id !== "ga")
    .slice(0, 5)
    .map((s) => s.topics[0]?.name)
    .filter((x): x is string => Boolean(x));
  const suggestions = [...topicSuggestions.slice(0, 4), ...(years[0] ? [`${years[0]} Q14`] : []), ...years.slice(0, 2).map(String), "eigenvalue"];

  const activeLabel = active ? CATEGORIES.find((c) => c.id === active)!.label : "";
  const status = !q
    ? "Enter a search term."
    : tooShort
      ? "Type at least 2 characters."
      : !hits.length
        ? `No results for “${q}”.`
        : active
          ? `${plural(counts[active], "result")} for “${q}” in ${activeLabel} (${plural(hits.length, "result")} in all categories).`
          : `${plural(hits.length, "result")} for “${q}”.`;
  const asksForMocks = /\bmocks?\b/i.test(q);

  return (
    <>
      <PageHeader title={q ? "Search results" : "Search"} crumbs={[{ label: "Search" }]} />
      <div className="space-y-6">
        <Card className="p-4 sm:p-5">
          <SearchForm q={q} />
        </Card>

        <p role="status" className={q ? "text-sm font-medium text-fg-2" : "sr-only"}>
          {status}
        </p>

        {hits.length ? <CategoryChips q={q} counts={counts} active={active} /> : null}

        {groups.map((g) => {
          const list = hits.filter((h) => h.category === g.id);
          const shown = active ? list : list.slice(0, PREVIEW_PER_GROUP);
          return (
            <section key={g.id} aria-labelledby={`grp-${g.id}`} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`grp-${g.id}`} className="text-lg font-semibold text-fg">
                  {g.label} <span className="tnum text-sm font-normal text-fg-3">({list.length})</span>
                </h2>
                {!active && list.length > shown.length ? (
                  <Link href={`/search?q=${encodeURIComponent(q)}&cat=${g.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                    Show all {list.length} {g.plural} <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
              <Card>
                <ul className="divide-y divide-border">
                  {shown.map((h) => {
                    const { snippet, meta } = describe(h, terms);
                    return (
                      <li key={h.id}>
                        <Link href={h.href} className="block px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2 sm:px-5">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {h.origin ? <OriginBadge origin={h.origin} /> : null}
                            <span className="font-medium text-accent-text">
                              <Highlight text={h.title} terms={terms} />
                            </span>
                          </span>
                          {snippet ? (
                            <span className="mt-1 block text-sm text-fg-2 wrap-anywhere">
                              <Highlight text={snippet} terms={terms} />
                            </span>
                          ) : null}
                          {meta.length ? <span className="mt-1 block text-xs text-fg-3">{meta.join(" · ")}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          );
        })}

        {active && hits.length && !counts[active] ? (
          <EmptyState
            title={`No ${CATEGORIES.find((c) => c.id === active)!.plural} match “${q}”`}
            action={
              <Link href={`/search?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-accent-text underline">
                Show all {plural(hits.length, "result")}
              </Link>
            }
          >
            The other categories have matches.
          </EmptyState>
        ) : null}

        {q.length >= 2 && !hits.length ? (
          <EmptyState title={`Nothing matched “${q}”`}>
            {asksForMocks ? (
              <p className="mb-2">
                Mock tests are not searchable, so their questions stay unseen until you take them. Browse them on the{" "}
                <Link href="/mocks" className="text-accent-text underline">
                  Mock Tests
                </Link>{" "}
                page.
              </p>
            ) : null}
            <p>Check the spelling, use fewer words, or try one of these:</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-fg-2 hover:bg-surface-2">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              A topic name, a year such as “{years[0] ?? 2026}”, or a question number such as “Q14” work well. You can also browse the{" "}
              <Link href="/syllabus" className="text-accent-text underline">
                syllabus
              </Link>{" "}
              or{" "}
              <Link href="/pyqs" className="text-accent-text underline">
                all PYQs
              </Link>
              .
            </p>
          </EmptyState>
        ) : null}

        {!q || tooShort ? (
          <Card className="p-4 sm:p-5">
            <h2 className="font-semibold text-fg">Try searching for</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <Link href={`/search?q=${encodeURIComponent(s)}`} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-fg-2 hover:bg-surface-2">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-fg-3">Search covers official PYQs, concepts, the formula book, syllabus topics and subjects, exam-strategy articles and verified practice questions.</p>
          </Card>
        ) : null}

        {asksForMocks && !hits.length ? null : (
          <p className="flex gap-2 text-sm text-fg-3">
            <EyeOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Mock-test questions are not searchable, so a mock you have not taken stays unseen. After you submit a mock, review its questions from the{" "}
              <Link href="/mocks" className="text-accent-text underline">
                Mock Tests
              </Link>{" "}
              page.
            </span>
          </p>
        )}
      </div>
    </>
  );
}
