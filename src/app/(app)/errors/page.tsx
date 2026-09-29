import type { Metadata } from "next";
import { getCatalog, getConcepts, getMocks } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ReviewTaxonomy } from "@/components/review/types";
import { ErrorLogClient } from "./ErrorLogClient";

export const metadata: Metadata = {
  title: "Error log",
  description: "Every mistake you have logged, classified by type, with the correct concept, your notes and its revision status.",
};

export default function ErrorsPage() {
  const catalog = getCatalog();
  const taxonomy: ReviewTaxonomy = {
    subjects: catalog.subjects.map((s) => ({ id: s.id as ReviewTaxonomy["subjects"][number]["id"], name: s.name, shortName: s.shortName })),
    topics: catalog.topics.map((t) => ({ id: t.id, subjectId: t.subjectId as ReviewTaxonomy["topics"][number]["subjectId"], name: t.name })),
  };
  // Suggestions for the "correct concept" field: concept titles, topic and subtopic names.
  const suggestions = [...new Set([...getConcepts().map((c) => c.title), ...catalog.topics.flatMap((t) => [t.name, ...t.subtopics.map((st) => st.name)])])].sort((a, b) => a.localeCompare(b));
  const availableMocks = getMocks()
    .filter((m) => m.available)
    .map((m) => m.id);
  return (
    <>
      <PageHeader
        title="Error log"
        description="Your mistakes, classified. Name what went wrong and the concept you missed, write what you will do differently, and send the questions back to revision until they are resolved."
        crumbs={[{ label: "Review" }, { label: "Error log" }]}
      />
      <ErrorLogClient taxonomy={taxonomy} conceptSuggestions={suggestions} availableMocks={availableMocks} />
    </>
  );
}
