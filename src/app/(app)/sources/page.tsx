import type { Metadata } from "next";
import { getBundle, getMocks, getPapers, getPattern, getPyqs, getSources, getWeightage } from "@/lib/server/repo";
import { DUPLICATE_THRESHOLD, PYQ_SIMILARITY_THRESHOLD } from "@/lib/content/review";
import { MASTERY_HALF_LIFE_DAYS, MASTERY_MIN_ATTEMPTS } from "@/lib/analytics/stats";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/insights/sources/ui";
import { PapersSection, PatternSection, SourceRegistry } from "@/components/insights/sources/Registry";
import { Disputes, OfficialMethod, OriginalMethod, Rubrics, StatusDefinitions, type DisputeItem, type OpenDisagreement, type PyqStats } from "@/components/insights/sources/Methodology";
import { ContentAuditReport, Copyright, MockVerificationReport } from "@/components/insights/sources/Reports";
import { loadContentAudit, loadFreeze, loadMockVerification, loadOfficialKeys } from "@/components/insights/sources/data";

export const metadata: Metadata = {
  title: "Sources & methodology",
  description: "Where every official fact comes from, how official PYQs and original questions are verified, what each verification status means, and how mastery and weightage are computed.",
};

const label = (q: { year?: number; questionNumber?: number }) => `GATE DA ${q.year} · Q.${q.questionNumber}`;

export default function SourcesPage() {
  const bundle = getBundle();
  const sources = getSources();
  const papers = getPapers();
  const pyqs = getPyqs();
  const mocks = getMocks();
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const sourceName = (id: string) => sourceById.get(id)?.name ?? id;

  const stats: PyqStats = {
    total: pyqs.length,
    papers: papers.length,
    transcriptionVerified: pyqs.filter((q) => q.transcription?.status === "VERIFIED").length,
    answerVerified: pyqs.filter((q) => q.answerVerification.status === "VERIFIED").length,
    agreeWithKey: pyqs.filter((q) => q.answerVerification.agreesWithKey).length,
    solutionVerified: pyqs.filter((q) => q.solutionStatus === "VERIFIED").length,
    withTeaching: pyqs.filter((q) => Boolean(q.html.teaching)).length,
    marksToAll: pyqs.filter((q) => q.answer.kind === "MTA").map((q) => ({ id: q.id, label: label(q) })),
  };
  const disputes: DisputeItem[] = pyqs
    .filter((q) => q.dispute)
    .map((q) => ({ id: q.id, label: label(q), decision: q.dispute!.decision, studentNote: q.dispute!.studentNote, resolvedAt: q.dispute!.resolvedAt, process: q.dispute!.process }));
  const open: OpenDisagreement[] = pyqs
    .filter((q) => !q.dispute && !q.answerVerification.agreesWithKey)
    .map((q) => ({ id: q.id, label: label(q), notes: q.answerVerification.notes || "The independent re-solve disagrees with the official key; the official answer is kept while this is reviewed." }));
  const loaded = Object.fromEntries(papers.map((p) => [p.id, pyqs.filter((q) => q.paperId === p.id).length]));
  const mockStats = {
    planned: mocks.length,
    available: mocks.filter((m) => m.available).length,
    verifiedQuestions: mocks.reduce((a, m) => a + m.verifiedCount, 0),
    plannedQuestions: mocks.reduce((a, m) => a + m.questionIds.length, 0),
  };
  const weightage = getWeightage().all;
  const audit = loadContentAudit();
  const mockReport = loadMockVerification();

  const toc: [string, string][] = [
    ["registry", "Source registry"],
    ["papers", "Exam papers"],
    ["pattern", "Exam pattern"],
    ["official", "How official PYQs are verified"],
    ["disputes", "Disputes"],
    ["originals", "How original questions are verified"],
    ["statuses", "Status definitions"],
    ["methods", "Difficulty, mastery and weightage"],
    ...(audit || mockReport ? ([["reports", "Audit reports"]] as [string, string][]) : []),
    ["copyright", "Copyright"],
  ];

  return (
    <>
      <PageHeader
        title="Sources & methodology"
        crumbs={[{ label: "Sources & methodology" }]}
        description="Where every official fact on this platform comes from, how each question is checked, and what the verification labels mean. Nothing official is ever invented; when something could not be confirmed directly, it says so."
      />

      <nav aria-label="On this page" className="mb-8 rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-3">On this page</p>
        <ol className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {toc.map(([id, text], i) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-8 items-center gap-2 text-accent-text hover:underline">
                <span className="tnum w-4 text-xs text-fg-3">{i + 1}</span>
                {text}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-12">
        <Section
          id="registry"
          title="Source registry"
          description="Every official document the platform relies on: the official URL, where the inspected bytes actually came from, the SHA-256 of those bytes, and how the status was reached."
        >
          <SourceRegistry sources={sources} />
        </Section>

        <Section id="papers" title="Exam papers" description="The official GATE DA papers on this platform. The date and slot facts carry their own status because the official per-paper schedule could not be read directly.">
          <PapersSection papers={papers} sourceName={sourceName} loaded={loaded} />
        </Section>

        <Section id="pattern" title="Exam pattern" description="Each fact about the exam format, with its status and the sources that support it.">
          <PatternSection pattern={getPattern()} sourceName={sourceName} />
        </Section>

        <Section id="official" title="How official PYQs are verified" description={`All ${stats.total} official questions from ${stats.papers} papers go through the same six stages.`}>
          <OfficialMethod stats={stats} keys={loadOfficialKeys()} freeze={loadFreeze()} sourceName={sourceName} />
        </Section>

        <Section id="disputes" title="Disputes">
          <Disputes disputes={disputes} open={open} />
        </Section>

        <Section id="originals" title="How original mock and practice questions are verified" description="Original questions are written for this platform and are never presented as official. They pass a stricter pipeline before any student sees them.">
          <OriginalMethod duplicateThreshold={DUPLICATE_THRESHOLD} pyqSimilarityThreshold={PYQ_SIMILARITY_THRESHOLD} mocks={mockStats} />
        </Section>

        <Section id="statuses" title="Status definitions">
          <StatusDefinitions />
        </Section>

        <Section id="methods" title="Difficulty, mastery and weightage">
          <Rubrics halfLifeDays={MASTERY_HALF_LIFE_DAYS} minAttempts={MASTERY_MIN_ATTEMPTS} papers={weightage.papers.length} confidence={weightage.confidenceNote} />
        </Section>

        {audit || mockReport ? (
          <Section id="reports" title="Audit reports" description="Machine-generated summaries of the content, read from the reports folder. Each shows when it was generated.">
            <div className="space-y-8">
              {audit ? <ContentAuditReport audit={audit} builtAt={bundle.builtAt} /> : null}
              {mockReport ? <MockVerificationReport report={mockReport} builtAt={bundle.builtAt} /> : null}
            </div>
          </Section>
        ) : null}

        <Section id="copyright" title="Copyright">
          <Copyright />
        </Section>
      </div>
    </>
  );
}
