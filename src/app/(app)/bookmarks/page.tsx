import type { Metadata } from "next";
import { getConcepts, getFormulas, getMocks, getStrategy, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookmarksClient, type BookmarkLibrary } from "./BookmarksClient";

export const metadata: Metadata = {
  title: "My bookmarks",
  description: "Questions, concepts, formulas and strategy articles you saved, with your notes. Bookmarked questions keep a copy you can read offline.",
};

export default function BookmarksPage() {
  const library: BookmarkLibrary = {
    subjects: getSubjects().map((s) => ({ id: s.id, shortName: s.shortName })),
    formulaSubject: Object.fromEntries(getFormulas().map((f) => [f.id, f.subjectId])),
    conceptIds: getConcepts().map((c) => c.id),
    strategyIds: getStrategy().map((s) => s.id),
    availableMocks: getMocks()
      .filter((m) => m.available)
      .map((m) => m.id),
  };
  return (
    <>
      <PageHeader
        title="My bookmarks"
        description="Everything you saved to come back to, with your own notes. Bookmarked questions keep a copy of the question that you can read without a connection."
        crumbs={[{ label: "Review" }, { label: "Bookmarks" }]}
      />
      <BookmarksClient library={library} />
    </>
  );
}
