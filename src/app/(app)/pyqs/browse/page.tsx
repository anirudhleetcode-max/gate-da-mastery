import type { Metadata } from "next";
import { getPapers, getPyqMetas, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { PyqBrowser } from "@/components/pyq/PyqBrowser";
import { sortPapersNewestFirst, toPaperInfo, toTaxonomy } from "@/components/pyq/data";
import { buildFilterContext, filtersToQuery, parseFilters } from "@/components/pyq/filters";
import { cleanPreview } from "@/components/pyq/preview";

export const metadata: Metadata = {
  title: "Browse GATE DA PYQs",
  description: "Filter every official GATE DA previous-year question by year, paper, subject, topic, difficulty, type, marks and your own progress.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BrowsePyqsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const papers = sortPapersNewestFirst(getPapers().map(toPaperInfo));
  const taxonomy = toTaxonomy(getSubjects());
  const rows = getPyqMetas().map((m) => ({ ...m, preview: cleanPreview(m.preview) }));
  const initial = parseFilters(sp, buildFilterContext(taxonomy, papers));

  return (
    <>
      <PageHeader
        title="Browse GATE DA PYQs"
        crumbs={[{ label: "PYQs", href: "/pyqs" }, { label: "Browse" }]}
        description="Every question from the official GATE DA papers. Filter by paper, subject, topic, difficulty, type, marks or your own status; open any question to attempt it and see the full solution."
      />
      {/* Keyed by the incoming query so links to other filter combinations start fresh. */}
      <PyqBrowser key={filtersToQuery(initial)} rows={rows} papers={papers} taxonomy={taxonomy} initial={initial} />
    </>
  );
}
