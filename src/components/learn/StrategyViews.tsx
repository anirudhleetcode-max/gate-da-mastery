/**
 * Presentational pieces of the exam-strategy hub and article pages. Hook-free
 * (server components; the bookmark button is a client island), and fed with
 * plain data so the pages stay thin.
 */
import Link from "next/link";
import { Timer } from "lucide-react";
import type { CompiledStrategy } from "@/lib/content/types";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { plural } from "@/lib/utils";
import { PrevNext, RICH_TABLES } from "./bits";

/** Headings inside an article body (the shared .rich style only sizes h3/h4). */
const ARTICLE_HEADINGS =
  "[&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_h2:first-child]:mt-0 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:text-fg [&_h4]:text-fg";

/** The page title is the only h1: a "# heading" in an article body is shown as a section heading (h2). */
export function articleHtml(html: string): string {
  return html.replace(/<(\/?)h1(?=[\s>])/g, "<$1h2");
}

export interface StrategySectionView {
  id: CompiledStrategy["section"];
  title: string;
  blurb: string;
  articles: Pick<CompiledStrategy, "id" | "title" | "summary">[];
}

/** The four sections of the hub, each listing its articles in authored order. */
export function StrategySections({ sections }: { sections: StrategySectionView[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((s) => (
        <section
          key={s.id}
          id={`section-${s.id}`}
          aria-labelledby={`section-${s.id}-h`}
          className="flex min-w-0 scroll-mt-20 flex-col rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]"
        >
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 id={`section-${s.id}-h`} className="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] font-semibold text-fg">
              {s.title}
              {s.articles.length ? <span className="tnum text-sm font-normal text-fg-3">{plural(s.articles.length, "article")}</span> : null}
            </h2>
            <p className="mt-0.5 text-sm text-fg-3">{s.blurb}</p>
          </div>
          {s.articles.length ? (
            <ol className="divide-y divide-border">
              {s.articles.map((a, i) => (
                <li key={a.id}>
                  <Link href={`/strategy/${a.id}`} className="group flex gap-3 px-4 py-3 hover:bg-surface-2 sm:px-5">
                    <span aria-hidden className="tnum mt-0.5 w-5 shrink-0 text-sm text-fg-3">
                      {i + 1}.
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-fg group-hover:underline">{a.title}</span>
                      <span className="mt-0.5 block text-sm text-fg-2">{a.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-4 text-sm text-fg-3 sm:px-5">No articles in this section yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}

/** An article with its section's reading list and previous / next within the section. */
export function StrategyArticleBody({
  article: a,
  sectionTitle,
  list,
}: {
  article: Pick<CompiledStrategy, "id" | "title" | "html">;
  sectionTitle: string;
  /** The section's articles in order (includes this one). */
  list: Pick<CompiledStrategy, "id" | "title">[];
}) {
  const idx = list.findIndex((x) => x.id === a.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <article aria-label={a.title} className="min-w-0 rounded-[var(--radius)] border border-border bg-surface px-4 py-5 shadow-[var(--shadow)] sm:px-6 sm:py-6">
          <ServerRichHtml html={articleHtml(a.html)} className={`max-w-[72ch] ${ARTICLE_HEADINGS} ${RICH_TABLES}`} />
        </article>

        <aside className="no-print min-w-0 space-y-4">
          <nav aria-label={`Articles in ${sectionTitle}`} className="rounded-[var(--radius)] border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-fg">
              {sectionTitle} <span className="tnum font-normal text-fg-3">({idx + 1} of {list.length})</span>
            </h2>
            <ol className="py-1">
              {list.map((x, i) => (
                <li key={x.id}>
                  <Link
                    href={`/strategy/${x.id}`}
                    aria-current={x.id === a.id ? "page" : undefined}
                    className="flex min-h-10 gap-2 px-4 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-text"
                  >
                    <span aria-hidden className="tnum w-4 shrink-0 text-xs leading-5 text-fg-3">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{x.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm text-fg-2">
            <p>There is no single, universally correct strategy. Try an idea in a timed mock before you rely on it.</p>
            <Link href="/strategy/timer" className="mt-2 inline-flex min-h-8 items-center gap-1.5 font-medium text-accent-text hover:underline">
              <Timer aria-hidden className="h-4 w-4" /> Exam timer simulator
            </Link>
          </div>
        </aside>
      </div>

      <PrevNext
        label={`Previous and next article in ${sectionTitle}`}
        kind="article"
        prev={prev ? { href: `/strategy/${prev.id}`, title: prev.title } : null}
        next={next ? { href: `/strategy/${next.id}`, title: next.title } : null}
      />
    </>
  );
}

/** The article's bookmark toggle (kind "strategy"). */
export function StrategyBookmark({ id, title }: { id: string; title: string }) {
  return <BookmarkButton kind="strategy" refId={id} title={title} className="min-h-10 sm:min-h-8" />;
}
