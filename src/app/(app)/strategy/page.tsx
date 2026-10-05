import type { Metadata } from "next";
import { ArrowRight, Compass, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { STRATEGY_SECTIONS, sectionArticles, strategyArticles } from "@/components/learn/server";
import { StrategySections } from "@/components/learn/StrategyViews";
import { plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "GATE DA exam strategy",
  description: "Exam strategy for GATE DA: before the exam, during the exam, time management and what to do after a mock, plus an exam timer simulator.",
};

export default function StrategyPage() {
  const total = strategyArticles().length;
  const sections = STRATEGY_SECTIONS.map((s) => ({ ...s, articles: sectionArticles(s.id).map((a) => ({ id: a.id, title: a.title, summary: a.summary })) }));

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
              What works depends on your strengths, your speed and how you react under time pressure. Treat these articles as starting points, not rules: try any
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

      <StrategySections sections={sections} />
    </>
  );
}
