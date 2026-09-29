import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Source, VerificationStatus } from "@/lib/content/schema";
import { getPapers, getPyqs, getSource, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerificationBadge } from "@/components/question/badges";
import { PyqSubjectCards, type SubjectPyqSummary } from "@/components/pyq/PyqSubjectCards";
import { PaperTimeline, type TimelinePaper } from "@/components/pyq/PaperTimeline";
import { DA_FIRST_YEAR, marksLabel, sortPapersNewestFirst, toTaxonomy } from "@/components/pyq/data";

export const metadata: Metadata = {
  title: "GATE DA Previous Year Questions",
  description: "Official GATE Data Science & AI previous-year questions by subject and year, with verification status and links to the official papers and answer keys.",
};

const STATUSES: VerificationStatus[] = ["VERIFIED", "PARTIALLY_VERIFIED", "NEEDS_REVIEW"];
const STATUS_HELP: Record<VerificationStatus, string> = {
  VERIFIED: "every check is fully verified",
  PARTIALLY_VERIFIED: "at least one check is only partly verified",
  NEEDS_REVIEW: "at least one check needs review",
};

export default function PyqsPage() {
  const pyqs = getPyqs();
  const papers = sortPapersNewestFirst(getPapers());
  const taxonomy = toTaxonomy(getSubjects());
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => a - b);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, pyqs.filter((q) => q.verification === s).length])) as Record<VerificationStatus, number>;
  const paperQuestions = papers.reduce((a, p) => a + p.totalQuestions, 0);

  const subjects: SubjectPyqSummary[] = taxonomy.map((s) => {
    const qs = pyqs.filter((q) => q.subjectId === s.id);
    return {
      id: s.id,
      name: s.name,
      ids: qs.map((q) => q.id),
      marks: qs.reduce((a, q) => a + q.marks, 0),
      byType: {
        MCQ: qs.filter((q) => q.type === "MCQ").length,
        MSQ: qs.filter((q) => q.type === "MSQ").length,
        NAT: qs.filter((q) => q.type === "NAT").length,
      },
      byYear: years.map((y) => {
        const inYear = qs.filter((q) => q.year === y);
        return { year: y, count: inYear.length, marks: inYear.reduce((a, q) => a + q.marks, 0) };
      }),
    };
  });

  const timeline: TimelinePaper[] = papers.map((p) => {
    const qs = pyqs.filter((q) => q.paperId === p.id);
    return {
      paper: p,
      loaded: qs.length,
      loadedMarks: qs.reduce((a, q) => a + q.marks, 0),
      questionPaper: getSource(p.questionPaperSourceId),
      answerKey: getSource(p.answerKeySourceId),
      scheduleSources: p.scheduleSourceIds.map((id) => getSource(id)).filter((s): s is Source => Boolean(s)),
    };
  });

  return (
    <>
      <PageHeader
        title="GATE DA Previous Year Questions"
        description={
          <>
            Every question here is from an official GATE Data Science &amp; Artificial Intelligence (DA) paper: transcribed from the question paper and answered according to the answer key
            published by that year&apos;s organizing institute.
          </>
        }
        actions={
          pyqs.length ? (
            <ButtonLink href="/pyqs/browse" variant="primary">
              Browse &amp; filter all PYQs <ArrowRight aria-hidden className="h-4 w-4" />
            </ButtonLink>
          ) : null
        }
      />

      {/* ---------------------------------------------------------- summary & verification */}
      <section aria-labelledby="pyq-summary-h" className="mb-8 rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
        <h2 id="pyq-summary-h" className="sr-only">
          Question bank and verification status
        </h2>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-8">
          <div>
            <p className="text-sm text-fg-3">Official questions in the question bank</p>
            <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-fg">{pyqs.length}</p>
            <p className="mt-1 text-sm text-fg-2">
              from {papers.length === 1 ? "1 official paper" : `${papers.length} official papers`}
              {papers.length ? ` (${years.join(", ")})` : ""}
              {paperQuestions > pyqs.length ? (
                <>
                  {" "}
                  · <span className="tnum">{paperQuestions - pyqs.length}</span> of the <span className="tnum">{paperQuestions}</span> questions in these papers are not in the bank yet
                </>
              ) : null}
            </p>
            <p className="tnum mt-1 text-sm text-fg-3">{marksLabel(pyqs.reduce((a, q) => a + q.marks, 0))} in total</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
              <ShieldCheck aria-hidden className="h-4 w-4 text-success" /> Verification status
            </p>
            <ul className="mt-2 space-y-1.5">
              {STATUSES.map((s) => (
                <li key={s} className="flex items-baseline gap-3 text-sm">
                  <span className="tnum w-9 shrink-0 text-right font-semibold text-fg">{counts[s]}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <VerificationBadge status={s} />
                    <span className="text-fg-3">{STATUS_HELP[s]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-fg-3">
              A question&apos;s badge is the weakest of its source, transcription, answer-key and solution checks.{" "}
              <Link href="/sources" className="font-medium text-accent-text hover:underline">
                How verification works
              </Link>
            </p>
          </div>
        </div>
      </section>

      {pyqs.length === 0 ? (
        <EmptyState title="No official questions are in the question bank yet" className="mb-8">
          The official papers are listed below. Their questions appear here, by subject and year, once they are added to the question bank.
        </EmptyState>
      ) : (
        <section aria-labelledby="pyq-subjects-h" className="mb-10">
          <div className="mb-3">
            <h2 id="pyq-subjects-h" className="text-lg font-semibold text-fg">
              By subject
            </h2>
            <p className="text-sm text-fg-3">
              Questions and marks across all loaded papers, including General Aptitude. Your completion counts the distinct questions you have attempted on this device.
            </p>
          </div>
          <PyqSubjectCards subjects={subjects} />
        </section>
      )}

      <section aria-labelledby="pyq-years-h">
        <div className="mb-4">
          <h2 id="pyq-years-h" className="text-lg font-semibold text-fg">
            Year timeline
          </h2>
          <p className="text-sm text-fg-3">
            The official DA papers in the question bank, newest first. GATE DA was first held in {DA_FIRST_YEAR}; no DA papers exist before {DA_FIRST_YEAR}.
          </p>
        </div>
        {timeline.length ? (
          <PaperTimeline papers={timeline} firstYear={DA_FIRST_YEAR} />
        ) : (
          <EmptyState title="No official DA papers are in the question bank yet">
            GATE DA was first held in {DA_FIRST_YEAR}. Each official paper appears here with its date, session, slot and official sources once it is added.
          </EmptyState>
        )}
      </section>
    </>
  );
}
