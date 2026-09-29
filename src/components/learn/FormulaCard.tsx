/**
 * One formula-book entry (server component; the bookmark and revision
 * buttons are client islands). The card's id is the formula id, so links of
 * the form /formulas/<subjectId>#<formulaId> land on it; scroll-margin keeps
 * it clear of the sticky header. Parts marked `formula-detail` are hidden in
 * the "Formulas only" view (see FormulaBookView).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Link2 } from "lucide-react";
import type { CompiledFormula } from "@/lib/content/types";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { cn } from "@/lib/utils";
import { FormulaMath, RICH_TABLES } from "./bits";
import { RevisionButton } from "./RevisionButton";

const DETAIL = "group-data-[compact=true]/book:hidden";

function Part({ title, children, className, tone }: { title: string; children: ReactNode; className?: string; tone?: "warning" | "muted" }) {
  return (
    <div
      className={cn(
        "min-w-0",
        tone === "warning" && "rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5",
        tone === "muted" && "rounded-lg border border-border bg-surface-2 px-3 py-2.5",
        className,
      )}
    >
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-3">{title}</h4>
      {children}
    </div>
  );
}

export function FormulaCard({ f, concepts }: { f: CompiledFormula; concepts: { id: string; title: string }[] }) {
  const headingId = `${f.id}-h`;
  return (
    <article id={f.id} aria-labelledby={headingId} className={cn("formula-card scroll-mt-20 rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]", RICH_TABLES)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 basis-56 items-start gap-1">
          <h3 id={headingId} className="min-w-0 text-base font-semibold leading-snug text-fg">
            {f.name}
          </h3>
          <a
            href={`#${f.id}`}
            className="no-print -my-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
            aria-label={`Link to this formula: ${f.name}`}
            title="Link to this formula"
          >
            <Link2 aria-hidden className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="no-print flex shrink-0 flex-wrap gap-2">
          <BookmarkButton
            kind="formula"
            refId={f.id}
            title={f.name}
            subjectId={f.subjectId}
            snapshot={{ html: f.html.formula, href: `/formulas/${f.subjectId}#${f.id}` }}
            label={f.name}
            className="min-h-10 sm:min-h-8"
          />
          <RevisionButton kind="formula" refId={f.id} title={f.name} subjectId={f.subjectId} topicId={f.topicId} label={f.name} />
        </div>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <FormulaMath html={f.html.formula} name={f.name} className="rounded-lg border border-border bg-surface-2/50 px-3 py-1" />
        <div className={cn("space-y-4", DETAIL)}>
          <Part title="Meaning">
            <ServerRichHtml html={f.html.meaning} />
          </Part>
          {f.html.variables.length ? (
            <Part title="Variables">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Symbols used in {f.name}</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-2 text-left text-xs text-fg-3">
                      <th scope="col" className="w-[30%] px-3 py-1.5 font-medium">
                        Symbol
                      </th>
                      <th scope="col" className="px-3 py-1.5 font-medium">
                        Meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.html.variables.map((v, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <th scope="row" className="px-3 py-1.5 text-left align-top font-normal">
                          <ServerRichHtml html={v.symbol} className="text-sm" />
                        </th>
                        <td className="px-3 py-1.5 align-top text-fg-2">{v.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Part>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Part title="When to use">
              <ServerRichHtml html={f.html.whenToUse} />
            </Part>
            <Part title="Common mistake" tone="warning">
              <ServerRichHtml html={f.html.commonMistake} />
            </Part>
          </div>
          <Part title="Worked example" tone="muted">
            <ServerRichHtml html={f.html.example} />
          </Part>
          {concepts.length ? (
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="text-fg-3">Related concepts:</span>
              {concepts.map((c) => (
                <Link key={c.id} href={`/concepts/${c.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                  {c.title}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
