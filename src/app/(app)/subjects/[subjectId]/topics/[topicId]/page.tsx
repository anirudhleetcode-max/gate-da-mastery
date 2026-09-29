import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Dumbbell } from "lucide-react";
import { getCatalog, getSubject, getSubjects, getTopic, getWeightage } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { VerificationBadge } from "@/components/question/badges";
import { DifficultyNote, SourceLinks, SubjectDot } from "@/components/subject/bits";
import { TopicMastery } from "@/components/subject/TopicMastery";
import { TopicPyqList } from "@/components/subject/TopicPyqList";
import { sourceRefs, topicPageData } from "@/components/subject/server";
import { formatMarks, plural } from "@/lib/utils";

type Params = { params: Promise<{ subjectId: string; topicId: string }> };

export function generateStaticParams() {
  return getSubjects().flatMap((s) => s.topics.map((t) => ({ subjectId: s.id, topicId: t.id })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subjectId, topicId } = await params;
  const subject = getSubject(subjectId);
  const topic = getTopic(topicId);
  if (!subject || !topic || topic.subjectId !== subject.id) return { title: "Topic not found" };
  return { title: `${topic.name} · ${subject.name}`, description: topic.summary };
}

export default async function TopicPage({ params }: Params) {
  const { subjectId, topicId } = await params;
  const data = topicPageData(subjectId, topicId);
  if (!data) notFound();
  const { subject, topic, phrases, pyqs, related, practiceCount, formulas, concepts } = data;

  const pyqMarks = pyqs.reduce((a, q) => a + q.marks, 0);
  const weightage = getWeightage()?.all;
  const freq = weightage?.topics.find((t) => t.topicId === topic.id);
  const paperCount = weightage?.papers.length ?? 0;
  const idx = subject.topics.findIndex((t) => t.id === topic.id);
  const prev = idx > 0 ? subject.topics[idx - 1] : null;
  const next = idx < subject.topics.length - 1 ? subject.topics[idx + 1] : null;
  const subjectHref = `/subjects/${subject.id}`;
  const topicHref = (id: string) => `/subjects/${subject.id}/topics/${id}`;
  const practiceHref = `/practice?topic=${topic.id}`;
  const canPractise = pyqs.length + practiceCount > 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Subjects", href: "/subjects" }, { label: subject.name, href: subjectHref }, { label: topic.name }]}
        title={topic.name}
        description={
          <>
            <p>{topic.summary}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-3">
              <SubjectDot id={subject.id} className="h-2 w-2" /> {subject.name} · topic {idx + 1} of {subject.topics.length}
            </p>
          </>
        }
        actions={
          canPractise ? (
            <ButtonLink href={practiceHref} variant="primary">
              <Dumbbell aria-hidden className="h-4 w-4" /> Practice this topic
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        {/* Your status and quick facts first on small screens (side by side on tablets); right column on large screens. */}
        <div className="grid min-w-0 gap-5 md:grid-cols-2 md:items-start lg:col-start-2 lg:row-start-1 lg:grid-cols-1">
          <TopicMastery catalog={getCatalog()} topicId={topic.id} />
          <Card>
            <CardHeader title="At a glance" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-fg-3">Official PYQs</dt>
                  <dd className="tnum font-semibold text-fg">
                    {pyqs.length}
                    {pyqs.length ? <span className="font-normal text-fg-3"> · {formatMarks(pyqMarks)} marks</span> : null}
                  </dd>
                </div>
                {related.length ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fg-3">Related PYQs (other topics)</dt>
                    <dd className="tnum font-semibold text-fg">{related.length}</dd>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-fg-3">Practice questions</dt>
                  <dd className="tnum font-semibold text-fg">{practiceCount}</dd>
                </div>
                <div>
                  <dt className="text-fg-3">Past-paper frequency (historical estimate)</dt>
                  <dd className="mt-0.5 text-fg-2">
                    {freq && paperCount ? (
                      <>
                        Appeared in <span className="tnum font-semibold text-fg">{freq.papersAppeared}</span> of {plural(paperCount, "official paper")}: {plural(freq.questions, "question")},{" "}
                        {formatMarks(freq.marks)} marks in total. Past papers only; not a prediction.
                      </>
                    ) : paperCount ? (
                      <>No classified official question from the {plural(paperCount, "paper")} is filed under this topic.</>
                    ) : (
                      <>No official papers are classified yet.</>
                    )}
                  </dd>
                </div>
              </dl>
              {!canPractise ? <p className="mt-4 text-sm text-fg-3">No questions for this topic are in the practice pool yet.</p> : null}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Card>
            <CardHeader
              title="Official syllabus coverage"
              description="The phrases of the official GATE DA syllabus this topic covers, quoted verbatim."
              action={<VerificationBadge status={subject.syllabusStatus} />}
            />
            <CardBody>
              <ul className="divide-y divide-border">
                {phrases.map((st) => {
                  const other = st.pyqCount - st.ownCount;
                  return (
                    <li key={st.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{st.name}</p>
                        <p className="text-sm text-fg-2">&ldquo;{st.officialPhrase}&rdquo;</p>
                      </div>
                      <p className="tnum shrink-0 text-xs text-fg-3 sm:text-right">
                        {st.pyqCount ? plural(st.pyqCount, "PYQ") : "no PYQs yet"}
                        {other > 0 ? <span className="sm:block"> ({other} under other topics)</span> : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-fg-3">
                <span>Section &ldquo;{subject.officialName}&rdquo; · verbatim from:</span>
                <SourceLinks sources={sourceRefs(subject.sourceIds)} />
                <Link href="/sources" className="font-medium text-accent-text hover:underline">
                  How the syllabus was verified
                </Link>
              </div>
            </CardBody>
          </Card>

          <section aria-labelledby="topic-pyqs-h" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="topic-pyqs-h" className="text-lg font-semibold text-fg">
                Official PYQs <span className="tnum text-base font-normal text-fg-3">({pyqs.length})</span>
              </h2>
              {pyqs.length ? (
                <Link href={`/pyqs/browse?subject=${subject.id}&topic=${topic.id}`} className="inline-flex min-h-8 items-center text-sm font-medium text-accent-text hover:underline">
                  Filter in PYQ browser
                </Link>
              ) : null}
            </div>
            {pyqs.length ? (
              <>
                <TopicPyqList rows={pyqs} />
                <DifficultyNote />
              </>
            ) : (
              <EmptyState title="No official PYQs are filed under this topic yet">
                {paperCount
                  ? `None of the classified questions from the ${plural(paperCount, "official paper")} is filed under this topic${related.length ? "; the related questions below test its syllabus phrases" : ""}. The phrases above are still examinable.`
                  : "Official questions appear here once papers are added to the question bank."}
              </EmptyState>
            )}
          </section>

          {related.length ? (
            <section aria-labelledby="topic-related-h" className="space-y-2">
              <div>
                <h2 id="topic-related-h" className="text-lg font-semibold text-fg">
                  Related PYQs from other topics <span className="tnum text-base font-normal text-fg-3">({related.length})</span>
                </h2>
                <p className="mt-0.5 text-sm text-fg-3">Filed under another topic, but they also test one of this topic&apos;s syllabus phrases.</p>
              </div>
              <TopicPyqList rows={related} kind="related" />
            </section>
          ) : null}

          <Card>
            <CardHeader
              title="Formulas"
              description={formulas.length ? `${plural(formulas.length, "formula")} from the formula book` : undefined}
              action={
                formulas.length ? (
                  <Link href={`/formulas/${subject.id}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                    Formula book <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              {formulas.length ? (
                <ul className="space-y-4">
                  {formulas.map((f) => (
                    <li key={f.id} className="min-w-0 border-b border-border pb-4 last:border-0 last:pb-0">
                      <h3 className="text-sm font-semibold text-fg">
                        <Link href={`/formulas/${subject.id}#${f.id}`} className="hover:underline">
                          {f.name}
                        </Link>
                      </h3>
                      {/* Wide formulas scroll inside this box (not the inner math block), and it is focusable so the keyboard can scroll it too. */}
                      <div role="group" aria-label={`Formula: ${f.name}`} tabIndex={0} className="mt-1 overflow-x-auto overflow-y-hidden rounded-md [&_.math-display]:overflow-visible!">
                        <ServerRichHtml html={f.html.formula} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">
                  The formula book has no formulas for this topic yet. The worked solutions of this topic&apos;s PYQs state every formula they use.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Concepts" description={concepts.length ? `${plural(concepts.length, "concept note")} for this topic` : undefined} />
            <CardBody>
              {concepts.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {concepts.map((c) => (
                    <li key={c.id}>
                      <Link href={`/concepts/${c.id}`} className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg hover:bg-surface-2">
                        <span className="min-w-0">{c.title}</span>
                        {!c.inOfficialSyllabus ? (
                          <Badge tone="outline" title="Supporting concept that is not an official syllabus phrase">
                            Supporting
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">
                  The concept library has no notes for this topic yet. {pyqs.length ? "Each PYQ solution above explains the concept it tests." : "The formula book and the subject's PYQs cover it for now."}
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <nav aria-label={`Topics in ${subject.name}`} className="min-w-0 lg:col-start-2 lg:row-start-2">
          <Card>
            <CardHeader title={`Topics in ${subject.name}`} />
            <ol className="py-1">
              {subject.topics.map((t, i) => (
                <li key={t.id}>
                  <Link
                    href={topicHref(t.id)}
                    aria-current={t.id === topic.id ? "page" : undefined}
                    className="flex min-h-10 items-center gap-2 px-4 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-text sm:px-5"
                  >
                    <span className="tnum w-4 shrink-0 text-xs text-fg-3">{i + 1}</span>
                    <span className="min-w-0">{t.name}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Link href={subjectHref} className="text-sm font-medium text-accent-text hover:underline">
                {subject.name} overview
              </Link>
            </div>
          </Card>
        </nav>
      </div>

      <nav aria-label="Previous and next topic" className="mt-8 flex items-stretch justify-between gap-3 border-t border-border pt-4">
        {prev ? (
          <Link href={topicHref(prev.id)} className="flex min-h-10 min-w-0 items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
            <ArrowLeft aria-hidden className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="sr-only">Previous topic: </span>
              {prev.name}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={topicHref(next.id)} className="flex min-h-10 min-w-0 items-center gap-1.5 text-right text-sm font-medium text-accent-text hover:underline">
            <span className="min-w-0">
              <span className="sr-only">Next topic: </span>
              {next.name}
            </span>
            <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
          </Link>
        ) : null}
      </nav>
    </>
  );
}
