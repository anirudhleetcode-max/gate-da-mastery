import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Source } from "@/lib/content/schema";
import { getPaper, getPapers, getPyqs, getSource, getSubjects, getTopic, getWeightage, toMeta } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarList, ChartFrame } from "@/components/charts/Charts";
import { PaperQuestionList, type PaperSection } from "@/components/pyq/PaperQuestionList";
import { ScheduleVerification, SourceDetail } from "@/components/pyq/Sources";
import { GA_LAST_QUESTION, slotName } from "@/components/pyq/data";
import { stemPreview } from "@/components/pyq/preview";
import { SUBJECT_ABBR, SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import { formatDate, formatMarks } from "@/lib/utils";

type Params = { params: Promise<{ paperId: string }> };

export function generateStaticParams() {
  return getPapers().map((p) => ({ paperId: p.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { paperId } = await params;
  const p = getPaper(paperId);
  if (!p) return { title: "Paper not found" };
  return {
    title: `GATE DA ${p.year} paper (Session ${p.session})`,
    description: `Official GATE ${p.year} Data Science & AI paper, ${formatDate(p.examDate)}: all questions in official order with subject-wise marks and official sources.`,
  };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-fg-3">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

export default async function PaperPage({ params }: Params) {
  const { paperId } = await params;
  const paper = getPaper(paperId);
  if (!paper) notFound();

  const questions = getPyqs()
    .filter((q) => q.paperId === paper.id)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0));
  const loadedMarks = questions.reduce((a, q) => a + q.marks, 0);
  const subjects = [...getSubjects()].sort((a, b) => a.order - b.order);

  // Subject-wise breakdown: the precomputed per-paper weightage, or the loaded questions if it is absent.
  const w = getWeightage().byPaper[paper.id];
  const breakdown = subjects.map((s) => {
    const stat = w?.subjects.find((x) => x.subjectId === s.id)?.perPaper.find((pp) => pp.paperId === paper.id);
    if (stat) return { id: s.id, name: s.name, questions: stat.questions, marks: stat.marks, byType: stat.byType };
    const qs = questions.filter((q) => q.subjectId === s.id);
    return {
      id: s.id,
      name: s.name,
      questions: qs.length,
      marks: qs.reduce((a, q) => a + q.marks, 0),
      byType: { MCQ: qs.filter((q) => q.type === "MCQ").length, MSQ: qs.filter((q) => q.type === "MSQ").length, NAT: qs.filter((q) => q.type === "NAT").length },
    };
  });

  const inSection = (n: number, key: "GA" | "DA") => (key === "GA" ? n <= GA_LAST_QUESTION : n > GA_LAST_QUESTION);
  const sections: PaperSection[] = (["GA", "DA"] as const).map((key) => {
    const from = key === "GA" ? 1 : GA_LAST_QUESTION + 1;
    const to = key === "GA" ? GA_LAST_QUESTION : paper.totalQuestions;
    const qs = questions.filter((q) => (q.section ?? (inSection(q.questionNumber ?? 0, "GA") ? "GA" : "DA")) === key);
    const have = new Set(qs.map((q) => q.questionNumber));
    const missing: number[] = [];
    for (let n = from; n <= to; n++) if (!have.has(n)) missing.push(n);
    return {
      key,
      title: key === "GA" ? `General Aptitude (Q.${from}–Q.${to})` : `Data Science & AI (Q.${from}–Q.${to})`,
      rows: qs.map((q) => ({ meta: { ...toMeta(q), preview: stemPreview(q.html.stem) }, topicName: getTopic(q.topicId)?.name ?? q.topicId })),
      missing,
    };
  });

  const qp = getSource(paper.questionPaperSourceId);
  const key = getSource(paper.answerKeySourceId);
  const scheduleSources = paper.scheduleSourceIds.map((id) => getSource(id)).filter((s): s is Source => Boolean(s));
  const coverage = questions.length === paper.totalQuestions ? `all ${paper.totalQuestions} questions` : `the ${questions.length} of ${paper.totalQuestions} questions loaded so far`;

  return (
    <>
      <PageHeader
        title={`GATE DA ${paper.year} paper`}
        crumbs={[{ label: "PYQs", href: "/pyqs" }, { label: `${paper.year} · Session ${paper.session}` }]}
        description={
          <>
            {paper.paperName} · Session {paper.session} · {formatDate(paper.examDate)} · organized by {paper.organizingInstitute}. Every question below is from this official paper.
          </>
        }
        actions={
          questions.length ? (
            <ButtonLink href={`/pyqs/browse?paper=${paper.id}`}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" /> Filter this paper
            </ButtonLink>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Paper details" description="As published for this exam session." />
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Fact label="Year">GATE {paper.year}</Fact>
              <Fact label="Paper code">{paper.paperCode}</Fact>
              <Fact label="Exam date">{formatDate(paper.examDate)}</Fact>
              <Fact label="Session">Session {paper.session}</Fact>
              <Fact label="Slot">
                {slotName(paper.slot)}
                <span className="block text-xs text-fg-3">{paper.slotTime}</span>
              </Fact>
              <Fact label="Duration">{paper.durationMinutes} minutes</Fact>
              <Fact label="Organizing institute">{paper.organizingInstitute}</Fact>
              <Fact label="Questions">
                <span className="tnum">{paper.totalQuestions}</span>
                <span className="tnum block text-xs text-fg-3">{questions.length} in the question bank</span>
              </Fact>
              <Fact label="Total marks">
                <span className="tnum">{formatMarks(paper.totalMarks)}</span>
                <span className="tnum block text-xs text-fg-3">{formatMarks(loadedMarks)} in loaded questions</span>
              </Fact>
            </dl>
            <ScheduleVerification status={paper.scheduleStatus} notes={paper.scheduleNotes} sources={scheduleSources} defaultOpen />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Official sources" description="The files every question on this page was transcribed from and checked against." />
          <CardBody className="space-y-5">
            {qp ? <SourceDetail source={qp} heading="Question paper" /> : <p className="text-sm text-fg-3">No official question-paper source is recorded for this paper.</p>}
            <div className="border-t border-border" />
            {key ? <SourceDetail source={key} heading="Answer key" /> : <p className="text-sm text-fg-3">No official answer-key source is recorded for this paper.</p>}
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="breakdown-h" className="mb-8">
        <h2 id="breakdown-h" className="sr-only">
          Subject-wise breakdown
        </h2>
        {questions.length ? (
          <ChartFrame
            title="Subject-wise marks in this paper"
            description={`Historical estimate for this paper only, from ${coverage}. Focus or hover a bar for the question types.`}
            table={{
              columns: ["Subject", "Questions", "Marks", "MCQ", "MSQ", "NAT"],
              rows: [
                ...breakdown.map((b) => [b.name, b.questions, formatMarks(b.marks), b.byType.MCQ, b.byType.MSQ, b.byType.NAT]),
                [
                  "Total",
                  breakdown.reduce((a, b) => a + b.questions, 0),
                  formatMarks(breakdown.reduce((a, b) => a + b.marks, 0)),
                  breakdown.reduce((a, b) => a + b.byType.MCQ, 0),
                  breakdown.reduce((a, b) => a + b.byType.MSQ, 0),
                  breakdown.reduce((a, b) => a + b.byType.NAT, 0),
                ],
              ],
            }}
          >
            {/* Full subject names where there is room; abbreviations keep the bars readable on phones. */}
            {(["full", "abbr"] as const).map((variant) => (
              <div key={variant} className={variant === "full" ? "hidden sm:block" : "sm:hidden [&_li]:grid-cols-[3.25rem_minmax(0,1fr)]"}>
                <BarList
                  ariaLabel={`Marks per subject in GATE DA ${paper.year}`}
                  data={breakdown.map((b) => ({
                    key: b.id,
                    label: variant === "full" ? SUBJECT_SHORT[b.id] : SUBJECT_ABBR[b.id],
                    value: b.marks,
                    color: SUBJECT_COLOR[b.id],
                    display: `${formatMarks(b.marks)} marks`,
                    detail: `${b.questions} ${b.questions === 1 ? "question" : "questions"} · MCQ ${b.byType.MCQ}, MSQ ${b.byType.MSQ}, NAT ${b.byType.NAT}`,
                  }))}
                />
              </div>
            ))}
            <div className="mt-3 border-t border-border pt-2 text-xs text-fg-3">
              <p id="paper-qcount-h" className="font-medium text-fg-2">
                Questions per subject
              </p>
              <ul aria-labelledby="paper-qcount-h" className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {breakdown.map((b) => (
                  <li key={b.id} className="whitespace-nowrap">
                    <abbr title={SUBJECT_SHORT[b.id]} className="no-underline">
                      {SUBJECT_ABBR[b.id]}
                    </abbr>{" "}
                    <span className="tnum font-medium text-fg-2">{b.questions}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartFrame>
        ) : null}
      </section>

      <section aria-labelledby="questions-h">
        <div className="mb-3">
          <h2 id="questions-h" className="text-lg font-semibold text-fg">
            Questions in official order
          </h2>
          <p className="text-sm text-fg-3">Numbered as in the official paper. Open a question to attempt it, check the official answer and read the full solution.</p>
        </div>
        {questions.length ? (
          <PaperQuestionList sections={sections} />
        ) : (
          <EmptyState title="No question from this paper is in the question bank yet" action={<ButtonLink href="/pyqs">All PYQ papers</ButtonLink>}>
            The paper details and official sources above are complete. Its questions will be listed here in official order once they are added.
          </EmptyState>
        )}
      </section>
    </>
  );
}
