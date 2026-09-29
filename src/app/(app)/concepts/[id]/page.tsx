import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Dumbbell, TriangleAlert } from "lucide-react";
import { getConcept, getConcepts, getFormula, getSubject, getSubtopicName, getTopic } from "@/lib/server/repo";
import type { CompiledConcept, CompiledFormula } from "@/lib/content/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { SubjectDot } from "@/components/subject/bits";
import { FormulaMath, LearnSection, OnThisPage, PrevNext, RICH_TABLES } from "@/components/learn/bits";
import { TableScrollFocus } from "@/components/learn/TableScrollFocus";
import { ConceptPracticeList, ConceptPyqList } from "@/components/learn/QuestionLinks";
import { RecordView } from "@/components/learn/RecordView";
import { RevisionButton } from "@/components/learn/RevisionButton";
import { SUPPORTING_LABEL } from "@/components/learn/library";
import { conceptPyqIds, conceptSummary, orderedConcepts, questionRows, topicPoolCount } from "@/components/learn/server";
import { plural } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getConcepts().map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = getConcept(id);
  if (!c) return { title: "Concept not found" };
  const subject = getSubject(c.subjectId);
  return { title: `${c.title} · ${subject?.shortName ?? "Concepts"}`, description: conceptSummary(c, 160) };
}

const isDefined = <T,>(x: T | undefined | null): x is T => x !== undefined && x !== null;

export default async function ConceptPage({ params }: Params) {
  const { id } = await params;
  const c = getConcept(id);
  if (!c) notFound();
  const subject = getSubject(c.subjectId);
  const topic = getTopic(c.topicId);
  if (!subject || !topic) notFound();

  const formulas: CompiledFormula[] = c.formulaIds.map((f) => getFormula(f)).filter(isDefined);
  const pyqRows = questionRows(conceptPyqIds(c));
  const practiceRows = questionRows(c.practiceIds).filter((q) => q.origin === "ORIGINAL_PRACTICE");
  const all = orderedConcepts();
  const related: CompiledConcept[] = c.relatedConceptIds.map((x) => getConcept(x)).filter(isDefined);
  const sameTopic = all.filter((x) => x.topicId === c.topicId && x.id !== c.id && !c.relatedConceptIds.includes(x.id));
  const inSubject = all.filter((x) => x.subjectId === c.subjectId);
  const idx = inSubject.findIndex((x) => x.id === c.id);
  const prev = idx > 0 ? inSubject[idx - 1] : null;
  const next = idx >= 0 && idx < inSubject.length - 1 ? inSubject[idx + 1] : null;
  const phrases = c.subtopicIds.map(getSubtopicName);
  const poolCount = topicPoolCount(c.topicId);
  const practiceHref = `/practice?subject=${c.subjectId}&topic=${c.topicId}&count=5`;
  const topicHref = `/subjects/${subject.id}/topics/${topic.id}`;
  const href = `/concepts/${c.id}`;

  const sections = [
    { id: "definition", title: "Definition" },
    { id: "intuition", title: "Intuition" },
    { id: "math", title: "Mathematical explanation" },
    { id: "example", title: "Worked example" },
    { id: "gate-relevance", title: "GATE relevance" },
    { id: "mistakes", title: "Common mistakes", count: c.html.commonMistakes.length },
    { id: "formulas", title: "Related formulas", count: formulas.length },
    { id: "pyqs", title: "Related official PYQs", count: pyqRows.length },
    { id: "practice", title: "Practice", count: practiceRows.length || undefined },
    { id: "related", title: "Related concepts", count: related.length + sameTopic.length },
  ];

  return (
    <>
      <RecordView kind="concept" refId={c.id} />
      <TableScrollFocus />
      <PageHeader
        crumbs={[
          { label: "Concepts", href: "/concepts" },
          { label: subject.name, href: `/concepts?subject=${subject.id}` },
          { label: topic.name, href: `/concepts?subject=${subject.id}#topic-${topic.id}` },
        ]}
        title={c.title}
        description={
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-3">
              <SubjectDot id={subject.id} className="h-2 w-2" />
              <Link href={`/subjects/${subject.id}`} className="hover:text-fg hover:underline">
                {subject.name}
              </Link>
              <span aria-hidden>›</span>
              <Link href={topicHref} className="hover:text-fg hover:underline">
                {topic.name}
              </Link>
            </p>
            {!c.inOfficialSyllabus || phrases.length ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-3">
                {!c.inOfficialSyllabus ? (
                  <Badge tone="warning" className="whitespace-normal" title="Useful background for the syllabus, but not itself a phrase of the official GATE DA syllabus">
                    {SUPPORTING_LABEL}
                  </Badge>
                ) : null}
                {phrases.length ? (
                  <>
                    <span>{c.inOfficialSyllabus ? "Syllabus items:" : "Supports:"}</span>
                    {phrases.map((p) => (
                      <Badge key={p} tone="outline" className="whitespace-normal">
                        {p}
                      </Badge>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        }
        actions={
          <>
            <BookmarkButton kind="concept" refId={c.id} title={c.title} subjectId={c.subjectId} snapshot={{ html: c.html.definition, href }} className="min-h-10 sm:min-h-8" />
            <RevisionButton kind="concept" refId={c.id} title={c.title} subjectId={c.subjectId} topicId={c.topicId} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <aside className="no-print hidden lg:col-start-2 lg:row-start-1 lg:block">
          <nav aria-label="On this page" className="sticky top-20 rounded-[var(--radius)] border border-border bg-surface p-2">
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-fg-3">On this page</p>
            <OnThisPage items={sections} />
          </nav>
        </aside>

        <div className={`min-w-0 space-y-5 lg:col-start-1 lg:row-start-1 ${RICH_TABLES}`}>
          <details className="no-print group rounded-[var(--radius)] border border-border bg-surface lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-fg">On this page</summary>
            <nav aria-label="On this page" className="border-t border-border p-2">
              <OnThisPage items={sections} />
            </nav>
          </details>

          <LearnSection id="definition" title="Definition" className="border-l-4 border-l-accent">
            <ServerRichHtml html={c.html.definition} />
          </LearnSection>
          <LearnSection id="intuition" title="Intuition">
            <ServerRichHtml html={c.html.intuition} />
          </LearnSection>
          <LearnSection id="math" title="Mathematical explanation">
            <ServerRichHtml html={c.html.math} />
          </LearnSection>
          <LearnSection id="example" title="Worked example" bodyClassName="bg-surface-2/60 rounded-b-[var(--radius)]">
            <ServerRichHtml html={c.html.example} />
          </LearnSection>
          <LearnSection id="gate-relevance" title="GATE relevance">
            <ServerRichHtml html={c.html.gateRelevance} />
          </LearnSection>
          <LearnSection id="mistakes" title="Common mistakes">
            <ul className="space-y-3">
              {c.html.commonMistakes.map((m, i) => (
                <li key={i} className="flex gap-2.5">
                  <TriangleAlert aria-hidden className="mt-1 h-4 w-4 shrink-0 text-warning" />
                  <ServerRichHtml html={m} className="min-w-0 flex-1" />
                </li>
              ))}
            </ul>
          </LearnSection>

          <LearnSection
            id="formulas"
            title="Related formulas"
            description={formulas.length ? `${plural(formulas.length, "formula")} from the ${subject.name} formula book` : undefined}
            action={
              <Link href={`/formulas/${subject.id}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                Formula book <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {formulas.length ? (
              <ul className="space-y-4">
                {formulas.map((f) => (
                  <li key={f.id} className="min-w-0 border-b border-border pb-4 last:border-0 last:pb-0">
                    <h3 className="text-sm font-semibold text-fg">
                      <Link href={`/formulas/${f.subjectId}#${f.id}`} className="hover:underline">
                        {f.name}
                      </Link>
                    </h3>
                    <FormulaMath html={f.html.formula} name={f.name} className="mt-1" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">No formula-book entry is linked to this concept. The mathematical explanation above states the formulas it uses.</p>
            )}
          </LearnSection>

          <LearnSection
            id="pyqs"
            title="Related official PYQs"
            description={pyqRows.length ? `${plural(pyqRows.length, "question")} from official GATE DA papers that test this concept` : undefined}
            action={
              <Link href={`/pyqs/browse?subject=${subject.id}&topic=${topic.id}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                All {topic.name} PYQs <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {pyqRows.length ? (
              <ConceptPyqList rows={pyqRows} />
            ) : (
              <p className="text-sm text-fg-3">
                No official GATE DA question is linked to this concept yet. The{" "}
                <Link href={topicHref} className="font-medium text-accent-text hover:underline">
                  {topic.name} topic page
                </Link>{" "}
                lists every official question filed under the topic.
              </p>
            )}
          </LearnSection>

          <LearnSection
            id="practice"
            title="Practice"
            description={practiceRows.length ? `${plural(practiceRows.length, "original practice question")} on this concept` : undefined}
            action={
              poolCount && practiceRows.length ? (
                <Link href={practiceHref} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                  Practise this topic <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          >
            {practiceRows.length ? (
              <ConceptPracticeList rows={practiceRows} />
            ) : poolCount ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-fg-2">
                  No practice question is linked to this concept yet.{" "}
                  {poolCount > 5
                    ? `Build a set of 5 from the ${plural(poolCount, "question")} on ${topic.name} in the practice pool.`
                    : `The practice pool has ${plural(poolCount, "question")} on ${topic.name}.`}
                </p>
                <ButtonLink href={practiceHref} variant="primary">
                  <Dumbbell aria-hidden className="h-4 w-4" /> Practise this topic
                </ButtonLink>
              </div>
            ) : (
              <p className="text-sm text-fg-3">No questions for {topic.name} are in the practice pool yet.</p>
            )}
          </LearnSection>

          <LearnSection id="related" title="Related concepts">
            {related.length || sameTopic.length ? (
              <div className="space-y-4">
                {related.length ? <ConceptLinks items={related} /> : null}
                {sameTopic.length ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-fg-2">More in {topic.name}</h3>
                    <ConceptLinks items={sameTopic} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-fg-3">
                No other concept note is linked yet.{" "}
                <Link href={`/concepts?subject=${subject.id}`} className="font-medium text-accent-text hover:underline">
                  Browse {subject.name} concepts
                </Link>
                .
              </p>
            )}
          </LearnSection>
        </div>
      </div>

      <PrevNext
        label={`Previous and next concept in ${subject.name}`}
        kind="concept"
        prev={prev ? { href: `/concepts/${prev.id}`, title: prev.title } : null}
        next={next ? { href: `/concepts/${next.id}`, title: next.title } : null}
      />
    </>
  );
}

function ConceptLinks({ items }: { items: CompiledConcept[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((x) => (
        <li key={x.id}>
          <Link href={`/concepts/${x.id}`} className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg hover:bg-surface-2">
            <span className="min-w-0">{x.title}</span>
            {!x.inOfficialSyllabus ? (
              <Badge tone="outline" title={SUPPORTING_LABEL}>
                Supporting
              </Badge>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
