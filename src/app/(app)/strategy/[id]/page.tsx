import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Timer } from "lucide-react";
import { getStrategy, getStrategyArticle } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { PrevNext, RICH_TABLES } from "@/components/learn/bits";
import { TableScrollFocus } from "@/components/learn/TableScrollFocus";
import { RecordView } from "@/components/learn/RecordView";
import { RESERVED_STRATEGY_IDS, sectionArticles, sectionTitle } from "@/components/learn/server";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getStrategy()
    .filter((a) => !RESERVED_STRATEGY_IDS.has(a.id))
    .map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const a = getStrategyArticle(id);
  if (!a) return { title: "Article not found" };
  return { title: `${a.title} · Exam strategy`, description: a.summary };
}

export default async function StrategyArticlePage({ params }: Params) {
  const { id } = await params;
  const a = getStrategyArticle(id);
  if (!a || RESERVED_STRATEGY_IDS.has(a.id)) notFound();
  const list = sectionArticles(a.section);
  const idx = list.findIndex((x) => x.id === a.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const section = sectionTitle(a.section);

  return (
    <>
      <RecordView kind="strategy" refId={a.id} />
      <TableScrollFocus />
      <PageHeader
        crumbs={[{ label: "Exam strategy", href: "/strategy" }, { label: section, href: `/strategy#section-${a.section}` }]}
        title={a.title}
        description={a.summary}
        actions={<BookmarkButton kind="strategy" refId={a.id} title={a.title} className="min-h-10 sm:min-h-8" />}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <article aria-label={a.title} className="min-w-0 rounded-[var(--radius)] border border-border bg-surface px-4 py-5 shadow-[var(--shadow)] sm:px-6 sm:py-6">
          <ServerRichHtml html={a.html} className={`max-w-[72ch] ${RICH_TABLES}`} />
        </article>

        <aside className="min-w-0 space-y-4">
          <nav aria-label={`Articles in ${section}`} className="rounded-[var(--radius)] border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-fg">{section}</h2>
            <ol className="py-1">
              {list.map((x, i) => (
                <li key={x.id}>
                  <Link
                    href={`/strategy/${x.id}`}
                    aria-current={x.id === a.id ? "page" : undefined}
                    className="flex min-h-10 gap-2 px-4 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-text"
                  >
                    <span className="tnum w-4 shrink-0 text-xs leading-5 text-fg-3">{i + 1}</span>
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
        label={`Previous and next article in ${section}`}
        kind="article"
        prev={prev ? { href: `/strategy/${prev.id}`, title: prev.title } : null}
        next={next ? { href: `/strategy/${next.id}`, title: next.title } : null}
      />
    </>
  );
}
