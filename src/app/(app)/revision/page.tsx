import type { Metadata } from "next";
import { getCatalog, getConcepts, getFormulas, getMocks, getSubjects, getWeightage } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import type { HighWeightTopic, ReviewConcept, ReviewFormula } from "@/components/review/types";
import { RevisionClient } from "./RevisionClient";

export const metadata: Metadata = {
  title: "Revision",
  description: "Spaced revision of the questions, concepts and formulas you need to keep fresh: due today, weak topics, incorrect answers, frequently forgotten items and PYQs to reattempt.",
};

/** How many of the top historical-marks topics count as "historically high-weight" (ties at the cut-off are included). */
const HIGH_WEIGHT_TOP = 10;

export default function RevisionPage() {
  const catalog = getCatalog();
  const topicName = new Map(catalog.topics.map((t) => [t.id, t.name]));
  const w = getWeightage().all;

  const ranked = [...w.topics].filter((t) => t.marks > 0).sort((a, b) => b.marks - a.marks || b.questions - a.questions || a.topicId.localeCompare(b.topicId));
  const threshold = ranked[Math.min(HIGH_WEIGHT_TOP, ranked.length) - 1]?.marks ?? 0;
  const highWeight: HighWeightTopic[] = ranked
    .filter((t) => threshold > 0 && t.marks >= threshold)
    .map((t) => ({
      topicId: t.topicId,
      subjectId: t.subjectId as HighWeightTopic["subjectId"],
      name: topicName.get(t.topicId) ?? t.topicId,
      marks: t.marks,
      questions: t.questions,
      papersAppeared: t.papersAppeared,
    }));

  const concepts: ReviewConcept[] = getConcepts().map((c) => ({ id: c.id, title: c.title, href: `/concepts/${c.id}`, subjectId: c.subjectId, topicId: c.topicId }));
  const formulas: ReviewFormula[] = getFormulas().map((f) => ({ id: f.id, name: f.name, subjectId: f.subjectId, topicId: f.topicId, html: f.html.formula }));
  const availableMocks = getMocks()
    .filter((m) => m.available)
    .map((m) => m.id);
  const subjectOrder = getSubjects().map((s) => s.id);

  return (
    <>
      <PageHeader
        title="Revision"
        description="Review what you are likely to forget, just before you forget it. Grade each item Got it, Almost or Forgot, and its next review date follows from your grade."
        crumbs={[{ label: "Review" }, { label: "Revision" }]}
      />
      <RevisionClient
        catalog={catalog}
        concepts={concepts}
        formulas={formulas}
        highWeight={highWeight}
        highWeightThreshold={threshold}
        paperCount={w.papers.length}
        availableMocks={availableMocks}
        subjectOrder={subjectOrder}
      />
    </>
  );
}
