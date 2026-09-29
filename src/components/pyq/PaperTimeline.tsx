/**
 * Year timeline of the official GATE DA papers in the question bank (server-compatible).
 */
import type { ExamPaper, Source } from "@/lib/content/schema";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate, formatMarks } from "@/lib/utils";
import { slotName } from "./data";
import { OfficialSourceLink, ScheduleVerification } from "./Sources";

export interface TimelinePaper {
  paper: ExamPaper;
  loaded: number;
  loadedMarks: number;
  questionPaper?: Source;
  answerKey?: Source;
  scheduleSources: Source[];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-fg-3">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

export function PaperTimeline({ papers, firstYear }: { papers: TimelinePaper[]; firstYear: number }) {
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border-strong" aria-label="Official GATE DA papers, newest first">
      {papers.map(({ paper: p, loaded, loadedMarks, questionPaper, answerKey, scheduleSources }) => {
        const missing = p.totalQuestions - loaded;
        return (
          <li key={p.id} className="relative pl-9">
            <span aria-hidden className="absolute left-[5px] top-5 h-[13px] w-[13px] rounded-full border-2 border-accent bg-surface" />
            <article aria-labelledby={`paper-${p.id}`} className="rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h3 id={`paper-${p.id}`} className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="tnum text-2xl font-semibold tracking-tight text-fg">{p.year}</span>
                    <span className="text-sm font-medium text-fg-2">GATE DA · Session {p.session}</span>
                  </h3>
                  <p className="text-sm text-fg-3">{p.paperName}</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <ButtonLink href={`/pyqs/papers/${p.id}`} variant="primary" className="flex-1 sm:flex-none">
                    View paper
                  </ButtonLink>
                  <ButtonLink href={`/pyqs/browse?year=${p.year}&sort=topic`} className="flex-1 sm:flex-none">
                    Subject-wise questions
                  </ButtonLink>
                </div>
              </header>
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                  <Fact label="Exam date">{formatDate(p.examDate)}</Fact>
                  <Fact label="Session">Session {p.session}</Fact>
                  <Fact label="Slot">
                    {slotName(p.slot)}
                    <span className="block text-xs text-fg-3">{p.slotTime}</span>
                  </Fact>
                  <Fact label="Organizing institute">{p.organizingInstitute}</Fact>
                  <Fact label="Questions loaded">
                    <span className="tnum">
                      {loaded} of {p.totalQuestions}
                    </span>
                  </Fact>
                  <Fact label="Total marks">
                    <span className="tnum">{formatMarks(p.totalMarks)}</span>
                    <span className="tnum block text-xs text-fg-3">{formatMarks(loadedMarks)} in loaded questions</span>
                  </Fact>
                </dl>
                {missing > 0 ? (
                  <p className="text-sm text-fg-3">
                    {missing === 1 ? "1 question" : `${missing} questions`} from this paper {missing === 1 ? "is" : "are"} not in the question bank yet, so subject counts for {p.year} are incomplete.
                  </p>
                ) : null}
                <ScheduleVerification status={p.scheduleStatus} notes={p.scheduleNotes} sources={scheduleSources} />
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {questionPaper ? <OfficialSourceLink source={questionPaper} /> : null}
                  {answerKey ? <OfficialSourceLink source={answerKey} /> : null}
                  {!questionPaper && !answerKey ? <p className="text-sm text-fg-3">No official source file is recorded for this paper.</p> : null}
                </div>
              </div>
            </article>
          </li>
        );
      })}
      <li className="relative pl-9">
        <span aria-hidden className="absolute left-[6px] top-1 h-[11px] w-[11px] rounded-full border-2 border-border-strong bg-bg" />
        <p className="text-sm text-fg-2">
          <span className="font-semibold text-fg">Before {firstYear}: no DA papers.</span> The Data Science &amp; Artificial Intelligence (DA) paper was first held in GATE {firstYear}, so there are no DA
          previous-year questions from earlier years.
        </p>
      </li>
    </ol>
  );
}
