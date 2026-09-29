import type { Metadata } from "next";
import { getCatalog, getConcepts, getFormulas, getPracticePoolMetas } from "@/lib/server/repo";
import { toPoolQuestion } from "@/lib/practice/pool";
import { PageHeader } from "@/components/ui/PageHeader";
import { TodayClient, type TodayConcept, type TodayFormula, type TodayTaxonomy } from "./TodayClient";

export const metadata: Metadata = {
  title: "Today's GATE DA",
  description: "A fresh daily study set: questions picked from your progress, a concept, five formulas, your revision due today and a weak-topic exercise.",
};

export default function TodayPage() {
  const catalog = getCatalog();
  // Selection metadata only; question content is fetched when the session starts. Mock questions are never part of the daily set.
  const pool = getPracticePoolMetas().map(toPoolQuestion);
  const concepts: TodayConcept[] = getConcepts().map((c) => ({ id: c.id, title: c.title, subjectId: c.subjectId, topicId: c.topicId }));
  const formulas: TodayFormula[] = getFormulas().map((f) => ({ id: f.id, name: f.name, subjectId: f.subjectId, topicId: f.topicId, html: f.html.formula }));
  const taxonomy: TodayTaxonomy = {
    subjects: catalog.subjects.map((s) => ({ id: s.id, name: s.name })),
    topics: catalog.topics.map((t) => ({ id: t.id, subjectId: t.subjectId, name: t.name, pyqMarks: t.pyqMarks })),
  };

  return (
    <>
      <PageHeader
        title="Today's GATE DA"
        description="A fresh set every day, chosen from your own progress: questions you have not tried or got wrong, extra weight on weak topics and on topics with revision due. It stays the same all day."
      />
      <TodayClient pool={pool} concepts={concepts} formulas={formulas} taxonomy={taxonomy} />
    </>
  );
}
