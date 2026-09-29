import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Timer } from "lucide-react";
import { getStrategy } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { STRATEGY_SECTIONS, sectionArticles } from "@/components/learn/server";
import { plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "GATE DA exam strategy",
  description: "Exam strategy for GATE DA: before the exam, during the exam, time management and what to do after a mock, plus an exam timer simulator.",
};

export default function StrategyPage() {
  const total = getStrategy().length;
  const sections = STRATEGY_SECTIONS.map((s) => ({ ...s, articles: sectionArticles(s.id) }));

  return (
    <>
      <PageHeader
        title="GATE DA exam strategy"
        crumbs={[{ label: "Learn" }, { label: "Exam strategy" }]}
        description={
          total
            ? `${plural(total, "article")} on preparing for the paper, working through it, managing the 180 minutes and learning from each mock.`
            : "Articles on preparing for the paper, working through it, managing the 180 minutes and learning from each mock."
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div role="note" aria-labelledby="no-single-strategy-h" className="flex gap-3 rounded-[var(--radius)] border-2 border-accent/40 bg-accent-soft px-4 py-4">
          <Compass aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
          <div className="min-w-0">
            <h2 id="no-single-strategy-h" className="font-semibold text-fg">
              There is no single, universally correct exam strategy
            </h2>
            <p className="mt-1 text-sm text-fg-2">
              What works depends on your strengths, your speed and how you react under time pressure. Treat these articles as tested starting points, not rules: try any
              change in a timed mock first, look at what it did to your score and your time, and keep only what works for you.
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface px-4 py-4 shadow-[var(--shadow)]">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <Timer aria-hidden className="h-4 w-4 text-fg-3" /> Exam timer simulator
            </h2>
            <p className="mt-1 text-sm text-fg-2">Practise pacing with the full 180-minute paper, a subject set or your own duration, with checkpoints and a live pace check.</p>
          </div>
          <ButtonLink href="/strategy/timer" variant="primary" className="self-start">
            Open the timer <ArrowRight aria-hidden className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>

      {!total ? (
        <p className="mb-4 text-sm text-fg-2">
          No strategy articles have been added yet. The sections below fill in as they are written; the exam timer already works.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.id} id={`section-${s.id}`} aria-labelledby={`section-${s.id}-h`} className="scroll-mt-20 flex min-w-0 flex-col rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <h2 id={`section-${s.id}-h`} className="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] font-semibold text-fg">
                {s.title}
                <span className="tnum text-sm font-normal text-fg-3">{s.articles.length ? plural(s.articles.length, "article") : ""}</span>
              </h2>
              <p className="mt-0.5 text-sm text-fg-3">{s.blurb}</p>
            </div>
            {s.articles.length ? (
              <ol className="divide-y divide-border">
                {s.articles.map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/strategy/${a.id}`} className="group flex gap-3 px-4 py-3 hover:bg-surface-2 sm:px-5">
                      <span className="tnum mt-0.5 w-5 shrink-0 text-sm text-fg-3">{i + 1}.</span>
                      <span className="min-w-0">
                        <span className="block font-medium text-fg group-hover:underline">{a.title}</span>
                        <span className="mt-0.5 block text-sm text-fg-2">{a.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-4 text-sm text-fg-3 sm:px-5">No articles in this section yet.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
