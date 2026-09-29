import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConceptLibrary } from "@/components/learn/ConceptLibrary";
import { libraryQuery, parseLibraryFilters } from "@/components/learn/library";
import { conceptListItems, librarySubjects } from "@/components/learn/server";

export const metadata: Metadata = {
  title: "Concept library",
  description: "Exam-focused GATE DA concept notes grouped by subject and topic: definition, intuition, the mathematics, a worked example, GATE relevance and common mistakes.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConceptsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const subjects = librarySubjects();
  const concepts = conceptListItems();
  const first = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const initial = parseLibraryFilters(first, new Set(subjects.map((s) => s.id)));
  return (
    <>
      <PageHeader
        title="Concept library"
        crumbs={[{ label: "Learn" }, { label: "Concepts" }]}
        description="Short, exam-focused notes for the GATE DA syllabus: a definition, the intuition, the mathematics, a worked example, how GATE tests it and the usual mistakes. Each note links to its formulas and to the official PYQs that test it."
      />
      {/* Keyed by the incoming query so a link with other filters starts fresh; the library then keeps its filters in the URL. */}
      <ConceptLibrary key={libraryQuery(initial)} subjects={subjects} concepts={concepts} />
    </>
  );
}
