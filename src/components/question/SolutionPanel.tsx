"use client";
import { Lightbulb, AlertTriangle, Zap } from "lucide-react";
import type { QuestionHtml } from "@/lib/content/types";
import { RichHtml } from "@/components/ui/RichHtml";
import { Segmented } from "@/components/ui/Segmented";
import { useSetting } from "@/lib/userdata/hooks";

export type ExplanationLevel = "quick" | "detailed" | "teaching";

export function SolutionPanel({ html, correctAnswerText }: { html: QuestionHtml; correctAnswerText: string }) {
  const [level, setLevel] = useSetting<ExplanationLevel>("explanationLevel", "detailed");
  const hasTeaching = Boolean(html.teaching);
  const effective: ExplanationLevel = level === "teaching" && !hasTeaching ? "detailed" : level;
  return (
    <section aria-labelledby="solution-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="solution-heading" className="text-lg font-semibold text-fg">
          Solution
        </h2>
        <Segmented
          label="Explanation level"
          size="sm"
          value={effective}
          onChange={setLevel}
          options={[
            { value: "quick", label: "Quick" },
            { value: "detailed", label: "Detailed" },
            ...(hasTeaching ? [{ value: "teaching" as const, label: "Teaching mode" }] : []),
          ]}
        />
      </div>

      <div className="rounded-lg border border-success/30 bg-success-soft px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-success">Correct answer</p>
        <div className="mt-1 text-fg">
          <RichHtml html={html.finalAnswer} />
          <span className="sr-only">{correctAnswerText}</span>
        </div>
      </div>

      {effective === "quick" ? <RichHtml html={html.quick} /> : null}

      {effective === "teaching" && html.teaching ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-info/30 bg-info-soft px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-info">Teaching mode: from first principles</p>
            <RichHtml html={html.teaching} />
          </div>
          <Steps steps={html.steps} />
        </div>
      ) : null}

      {effective === "detailed" ? <Steps steps={html.steps} /> : null}

      {html.optionAnalysis?.length ? (
        <div>
          <h3 className="mb-2 font-semibold text-fg">Why each option is right or wrong</h3>
          <ul className="space-y-2">
            {html.optionAnalysis.map((o) => (
              <li key={o.label} className="flex gap-3 rounded-lg border border-border px-3 py-2">
                <span className={o.verdict === "correct" ? "w-24 shrink-0 whitespace-nowrap font-semibold text-success" : "w-24 shrink-0 whitespace-nowrap font-semibold text-danger"}>
                  ({o.label}) {o.verdict === "correct" ? "Correct" : "Wrong"}
                </span>
                <RichHtml html={o.html} className="min-w-0 flex-1" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {html.shortcut ? (
          <div className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-accent-text">
              <Zap aria-hidden className="h-4 w-4" /> GATE shortcut
            </p>
            <RichHtml html={html.shortcut} />
          </div>
        ) : null}
        {html.commonTrap ? (
          <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warning">
              <AlertTriangle aria-hidden className="h-4 w-4" /> Common trap
            </p>
            <RichHtml html={html.commonTrap} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Steps({ steps }: { steps: QuestionHtml["steps"] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="mb-1.5 flex items-center gap-2 font-semibold text-fg">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-fg-2">{i + 1}</span>
            {s.title}
          </p>
          <RichHtml html={s.html} />
        </li>
      ))}
    </ol>
  );
}

export function ConceptHint() {
  return <Lightbulb aria-hidden className="h-4 w-4" />;
}
