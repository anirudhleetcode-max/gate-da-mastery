import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept, getSubject, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubjectDot } from "@/components/subject/bits";
import { FormulaCard } from "@/components/learn/FormulaCard";
import { FormulaBookView } from "@/components/learn/FormulaBookView";
import { OnThisPage } from "@/components/learn/bits";
import { FORMULA_PRINT_CSS } from "@/components/learn/print";
import { TableScrollFocus } from "@/components/learn/TableScrollFocus";
import { learnSubjects, orderedFormulas } from "@/components/learn/server";
import { plural } from "@/lib/utils";

type Params = { params: Promise<{ subjectId: string }> };

export function generateStaticParams() {
  return getSubjects().map((s) => ({ subjectId: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subjectId } = await params;
  const subject = getSubject(subjectId);
  if (!subject) return { title: "Formula book not found" };
  return {
    title: `${subject.name} formulas`,
    description: `Formula book for ${subject.name} (GATE DA): each formula with its meaning, variables, when to use it, the common mistake and a worked example.`,
  };
}

export default async function SubjectFormulasPage({ params }: Params) {
  const { subjectId } = await params;
  const subject = getSubject(subjectId);
  if (!subject) notFound();

  const formulas = orderedFormulas(subject.id);
  const groups = subject.topics.map((t) => ({ topic: t, items: formulas.filter((f) => f.topicId === t.id) }));
  const filled = groups.filter((g) => g.items.length);
  const empty = groups.filter((g) => !g.items.length);
  const others = learnSubjects()
    .filter((s) => s.id !== subject.id)
    .map((s) => ({ ...s, count: orderedFormulas(s.id).length }));
  const conceptRefs = (ids: string[]) =>
    ids
      .map((id) => getConcept(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, title: c.title }));

  const header = (
    <PageHeader
      crumbs={[{ label: "Formula book", href: "/formulas" }, { label: subject.name }]}
      title={`${subject.name} formulas`}
      description={
        <p>
          <SubjectDot id={subject.id} className="mr-2 h-2 w-2 align-middle" />
          {formulas.length
            ? `${plural(formulas.length, "formula")} in ${plural(filled.length, "topic")}. Each card gives the meaning, the variables, when to use it, the common mistake and a worked example.`
            : "No formulas for this subject yet."}
        </p>
      }
    />
  );

  if (!formulas.length) {
    return (
      <>
        {header}
        <EmptyState
          title={`The formula book has no ${subject.name} formulas yet`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/subjects/${subject.id}`} variant="primary">
                {subject.name} overview
              </ButtonLink>
              <ButtonLink href="/formulas">All subjects</ButtonLink>
            </div>
          }
        >
          Formulas are added subject by subject. Until this one has them, the worked solutions of its official PYQs state every formula they use.
        </EmptyState>
        {others.some((o) => o.count) ? (
          <nav aria-label="Other formula books" className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-fg-2">Subjects with formulas</h2>
            <ul className="flex flex-wrap gap-2">
              {others
                .filter((o) => o.count)
                .map((o) => (
                  <li key={o.id}>
                    <Link href={`/formulas/${o.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg sm:min-h-8">
                      <SubjectDot id={o.id} className="h-2 w-2" />
                      {o.name}
                      <span className="tnum text-xs text-fg-3">{o.count}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        ) : null}
      </>
    );
  }

  const topicItems = filled.map((g) => ({ id: `topic-${g.topic.id}`, title: g.topic.name, count: g.items.length }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORMULA_PRINT_CSS }} />
      <TableScrollFocus />
      {header}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <aside className="no-print hidden lg:col-start-2 lg:row-start-1 lg:block">
          <nav aria-label="Topics in this formula book" className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[var(--radius)] border border-border bg-surface p-2">
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-fg-3">Jump to topic</p>
            <OnThisPage items={topicItems} />
            <div className="mt-2 border-t border-border px-2 pt-2">
              <Link href="/formulas" className="inline-flex min-h-8 items-center text-sm font-medium text-accent-text hover:underline">
                All subjects
              </Link>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <details className="no-print mb-4 rounded-[var(--radius)] border border-border bg-surface lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-fg">
              Jump to a topic <span className="tnum text-xs font-normal text-fg-3">({plural(topicItems.length, "topic")})</span>
            </summary>
            <nav aria-label="Jump to topic" className="border-t border-border p-2">
              <OnThisPage items={topicItems} />
            </nav>
          </details>

          <FormulaBookView count={formulas.length}>
            <div className="space-y-8">
              {filled.map(({ topic, items }) => (
                <section key={topic.id} id={`topic-${topic.id}`} aria-labelledby={`topic-${topic.id}-h`} className="scroll-mt-20 space-y-4">
                  <h2 id={`topic-${topic.id}-h`} className="formula-topic-heading flex flex-wrap items-baseline gap-x-2 border-b border-border pb-2 text-lg font-semibold text-fg">
                    {topic.name}
                    <span className="tnum text-sm font-normal text-fg-3">{plural(items.length, "formula")}</span>
                  </h2>
                  {items.map((f) => (
                    <FormulaCard key={f.id} f={f} concepts={conceptRefs(f.conceptIds)} />
                  ))}
                </section>
              ))}
            </div>
          </FormulaBookView>

          {empty.length ? (
            <p className="no-print mt-8 text-sm text-fg-3">
              <span className="font-medium text-fg-2">No formulas yet for:</span> {empty.map((g) => g.topic.name).join(", ")}.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
