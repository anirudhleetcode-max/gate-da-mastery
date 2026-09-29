import type { Metadata } from "next";
import { getPapers, getPyqs, getSubjects, toMeta } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { PyqBrowser } from "@/components/pyq/PyqBrowser";
import { sortPapersNewestFirst, toPaperInfo, toTaxonomy } from "@/components/pyq/data";
import { buildFilterContext, filtersToQuery, parseFilters } from "@/components/pyq/filters";
import { stemPreview } from "@/components/pyq/preview";

export const metadata: Metadata = {
  title: "Browse GATE DA PYQs",
  description: "Filter every official GATE DA previous-year question by year, paper, subject, topic, difficulty, type, marks and your own progress.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BrowsePyqsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const papers = sortPapersNewestFirst(getPapers().map(toPaperInfo));
  const taxonomy = toTaxonomy(getSubjects());
  // List metadata only (no HTML, answers or solutions); previews keep formulas readable.
  const rows = getPyqs().map((q) => ({ ...toMeta(q), preview: stemPreview(q.html.stem) }));
  const initial = parseFilters(sp, buildFilterContext(taxonomy, papers));

  return (
    <>
      <PageHeader
        title="Browse GATE DA PYQs"
        crumbs={[{ label: "PYQs", href: "/pyqs" }, { label: "Browse" }]}
        description="Every question from the official GATE DA papers. Filter by paper, subject, topic, difficulty, type, marks or your own status; open any question to attempt it and see the full solution."
      />
      {/* Keyed by the incoming query so links to other filter combinations start fresh; the browser reads its filters from the URL. */}
      <PyqBrowser key={filtersToQuery(initial)} rows={rows} papers={papers} taxonomy={taxonomy} />
    </>
  );
}
