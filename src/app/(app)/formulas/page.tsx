import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Callout } from "@/components/ui/Callout";
import { SubjectDot } from "@/components/subject/bits";
import { learnSubjects, orderedFormulas } from "@/components/learn/server";
import { LinkCount } from "@/components/learn/LinkCount";
import { plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Formula book",
  description: "The GATE DA formula book by subject and topic: every formula with its meaning, variables, when to use it, the common mistake and a worked example. Printable.",
};

export default function FormulasPage() {
  const subjects = learnSubjects().map((s) => {
    const formulas = orderedFormulas(s.id);
    return { ...s, count: formulas.length, topics: s.topics.map((t) => ({ ...t, count: formulas.filter((f) => f.topicId === t.id).length })) };
  });
  const total = subjects.reduce((a, s) => a + s.count, 0);
  const covered = subjects.filter((s) => s.count).length;

  return (
    <>
      <PageHeader
        title="Formula book"
        crumbs={[{ label: "Learn" }, { label: "Formula book" }]}
        description={
          total ? (
            <>
              <span className="tnum font-semibold text-fg">{plural(total, "formula")}</span> across {plural(covered, "subject")}, grouped by topic. Each entry gives the meaning,
              the variables, when to use it, the common mistake and a worked example.
            </>
          ) : (
            "Formulas are grouped by subject and topic. Each entry gives the meaning, the variables, when to use it, the common mistake and a worked example."
          )
        }
      />

      <Callout tone="info" title="Printing a subject" className="mb-6">
        <p>
          Open a subject and choose <span className="font-medium text-fg">Print</span> (or press Ctrl + P / ⌘ P). The navigation, buttons and dark theme are left out, and each
          formula card is kept on one page where it fits. Switch the view to <span className="font-medium text-fg">Formulas only</span> first for a compact revision sheet.
        </p>
      </Callout>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((s) => (
          <li key={s.id} className="flex min-w-0 flex-col rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="flex min-w-0 items-center gap-2 text-[0.95rem] font-semibold text-fg">
                <SubjectDot id={s.id} />
                {s.count ? (
                  <Link href={`/formulas/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                ) : (
                  <span>{s.name}</span>
                )}
              </h2>
              <span className="tnum shrink-0 pt-0.5 text-sm text-fg-3">{s.count ? plural(s.count, "formula") : "0 formulas"}</span>
            </div>
            {s.count ? (
              <>
                <ul className="flex-1 px-2 py-2">
                  {s.topics.map((t) => (
                    <li key={t.id}>
                      {t.count ? (
                        <Link
                          href={`/formulas/${s.id}#topic-${t.id}`}
                          className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg"
                        >
                          <span className="min-w-0">{t.name}</span>
                          <LinkCount n={t.count} />
                        </Link>
                      ) : (
                        <span className="flex min-h-9 items-center justify-between gap-2 px-2 py-1 text-sm text-fg-3">
                          <span className="min-w-0">{t.name}</span>
                          <span className="text-xs">none yet</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <Link href={`/formulas/${s.id}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                    Open <span className="sr-only">the {s.name} formula book</span>
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                  <span className="inline-flex items-center gap-1 text-xs text-fg-3">
                    <Printer aria-hidden className="h-3.5 w-3.5" /> Printable
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-1 px-4 py-3 text-sm text-fg-3">
                <p>No formulas for this subject yet. The worked solutions of its official PYQs state the formulas they use.</p>
                <Link href={`/subjects/${s.id}`} className="mt-2 inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                  {s.name} overview
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
