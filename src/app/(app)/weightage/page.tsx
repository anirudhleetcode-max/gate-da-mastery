import type { Metadata } from "next";
import { getPapers, getPyqs, getSubjects, getWeightage } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { WeightageView, type WeightageViewProps } from "@/components/insights/WeightageView";

export const metadata: Metadata = {
  title: "Weightage (historical GATE DA data)",
  description: "Subject and topic distribution observed in the official GATE DA papers. Historical observation, not a prediction.",
};

export default function WeightagePage() {
  const w = getWeightage();
  const papers = getPapers();
  const pyqs = getPyqs();
  const subjects = getSubjects().map((s) => ({ id: s.id, name: s.name, shortName: s.shortName, topics: s.topics.map((t) => ({ id: t.id, name: t.name })) }));
  const typeMix = papers.map((p) => {
    const qs = pyqs.filter((q) => q.paperId === p.id);
    const count = (f: (q: (typeof qs)[number]) => boolean) => qs.filter(f).length;
    return {
      paperId: p.id,
      year: p.year,
      questions: qs.length,
      mcq: count((q) => q.type === "MCQ"),
      msq: count((q) => q.type === "MSQ"),
      nat: count((q) => q.type === "NAT"),
      oneMark: count((q) => q.marks === 1),
      twoMark: count((q) => q.marks === 2),
    };
  });
  const props: WeightageViewProps = {
    all: w.all,
    byPaper: w.byPaper,
    papers: papers.map((p) => ({ id: p.id, year: p.year, examDate: p.examDate, session: p.session, slot: p.slot, loaded: pyqs.filter((q) => q.paperId === p.id).length, total: p.totalQuestions })),
    subjects,
    typeMix,
    verification: {
      total: pyqs.length,
      contentVerified: pyqs.filter((q) => q.answerVerification.status === "VERIFIED" && q.transcription?.status === "VERIFIED" && q.solutionStatus === "VERIFIED").length,
      needsReview: pyqs.filter((q) => q.verification === "NEEDS_REVIEW").length,
    },
  };
  return (
    <>
      <PageHeader
        title="GATE DA weightage"
        description={
          <>
            <span className="mr-2 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-warning">Historical GATE DA data</span>
            Observed subject and topic distribution in the official DA papers. It describes past papers only; it does not predict or guarantee the next paper.
          </>
        }
        crumbs={[{ label: "Insights" }, { label: "Weightage" }]}
      />
      <WeightageView {...props} />
    </>
  );
}
