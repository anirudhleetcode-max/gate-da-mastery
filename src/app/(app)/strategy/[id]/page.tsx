import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStrategy, getStrategyArticle } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { StrategyArticleBody, StrategyBookmark } from "@/components/learn/StrategyViews";
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
  const list = sectionArticles(a.section).map((x) => ({ id: x.id, title: x.title }));
  const section = sectionTitle(a.section);

  return (
    <>
      <RecordView kind="strategy" refId={a.id} />
      <TableScrollFocus />
      <PageHeader
        crumbs={[{ label: "Exam strategy", href: "/strategy" }, { label: section, href: `/strategy#section-${a.section}` }]}
        title={a.title}
        description={a.summary}
        actions={<StrategyBookmark id={a.id} title={a.title} />}
      />

      <StrategyArticleBody article={a} sectionTitle={section} list={list} />
    </>
  );
}
