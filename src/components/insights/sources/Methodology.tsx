/** Verification methodology, disputes, status definitions and rubrics (server components). */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Gavel } from "lucide-react";
import { VerificationBadge } from "@/components/question/badges";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { DIFFICULTY_LABEL } from "@/lib/labels";
import { formatDate, plural } from "@/lib/utils";
import type { FreezeSummary, KeyTableSummary } from "./data";
import { formatStamp } from "./data";
import { H3, Mono, Step } from "./ui";

// ------------------------------------------------------------------ official PYQs

export interface PyqStats {
  total: number;
  papers: number;
  transcriptionVerified: number;
  answerVerified: number;
  agreeWithKey: number;
  solutionVerified: number;
  withTeaching: number;
  marksToAll: { id: string; label: string }[];
}

export function OfficialMethod({ stats, keys, freeze, sourceName }: { stats: PyqStats; keys: KeyTableSummary[] | null; freeze: FreezeSummary | null; sourceName: (id: string) => string }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <ol className="space-y-4">
            <Step n={1} title="Transcription from the official master question paper" meta={`${stats.transcriptionVerified} of ${stats.total} transcriptions verified`}>
              The question text, options and code are reproduced verbatim from the official paper; mathematics is converted to LaTeX without changing its meaning, and figures are cropped from the
              official rendering. A second, independent check compares every transcription side by side with the official rendering (the “Compare with official rendering” button on a question).
            </Step>
            <Step n={2} title="Author solve" meta={`${stats.withTeaching} of ${stats.total} solutions include a teaching-mode explanation`}>
              A complete step-by-step solution is written, with a Python check for anything numerical or algorithmic.
            </Step>
            <Step n={3} title="Blind independent re-solve" meta={`${stats.answerVerified} of ${stats.total} answers verified; ${stats.agreeWithKey} agree with the official key`}>
              A separate solver works the question without seeing the key. If the two disagree, the question is re-derived; a disagreement that persists is never “fixed” by changing the official answer. It
              is recorded and escalated (see Disputes below).
            </Step>
            <Step
              n={4}
              title="Cross-check against the official answer-key table"
              meta={keys ? `${keys.length} key tables · ${keys.reduce((a, k) => a + k.rows, 0)} rows · ${keys.reduce((a, k) => a + k.mta, 0)} marked “marks to all”` : "The answer-key table file is missing"}
            >
              The official answer-key PDFs are parsed programmatically into <Mono>content/exam/official-keys.json</Mono>. The content build fails if any question&apos;s key cell, type, marks or section
              differs from that table, so a transcription slip in the answer cannot reach students.
            </Step>
            <Step n={5} title="Solution review" meta={`${stats.solutionVerified} of ${stats.total} solutions reviewed and verified`}>
              An independent reviewer checks every step of the solution and the option-by-option analysis against the official key.
            </Step>
            <Step n={6} title="PYQ freeze" meta={freeze ? `${freeze.count} files frozen · last freeze ${formatStamp(freeze.frozenAt)}` : "The freeze manifest is missing"}>
              <Mono>content/exam/pyq-freeze.json</Mono> records, for every PYQ file, a SHA-256 of the file and a manifest of the fields that must never drift silently (id, paper, question number, section,
              type, marks, answer, official key cell and sources). The test suite fails on any change; re-opening the frozen set requires a written reason, which is logged below.
            </Step>
          </ol>
        </CardBody>
      </Card>

      {stats.marksToAll.length ? (
        <Callout tone="info" title="Marks to all">
          The official key awarded marks to every candidate for {stats.marksToAll.map((m, i) => (
            <span key={m.id}>
              {i ? ", " : ""}
              <Link href={`/questions/${m.id}`} className="font-medium text-accent-text underline">
                {m.label}
              </Link>
            </span>
          ))}
          . Such questions are shown with their analysis but are not scored in practice.
        </Callout>
      ) : null}

      {keys?.length ? (
        <div className="space-y-2">
          <H3>Official answer-key tables</H3>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Official answer-key tables used for the cross-check</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-fg-3">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Paper
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Rows
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Marks
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Parsed from
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.paperId} className="border-b border-border last:border-0">
                      <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-medium">
                        {k.paperId}
                      </th>
                      <td className="tnum px-4 py-2 text-right">{k.rows}</td>
                      <td className="tnum px-4 py-2 text-right">{k.marks}</td>
                      <td className="min-w-48 px-4 py-2 text-fg-2">
                        <a href={`#source-${k.sourceId}`} className="text-accent-text hover:underline">
                          {sourceName(k.sourceId)}
                        </a>
                        <span className="block text-xs text-fg-3">{k.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {freeze ? <FreezeLog freeze={freeze} /> : null}
    </div>
  );
}

function FreezeLog({ freeze }: { freeze: FreezeSummary }) {
  return (
    <div className="space-y-2">
      <H3>PYQ freeze log</H3>
      <p className="text-sm text-fg-2">
        {plural(freeze.count, "question file")} frozen ({Object.entries(freeze.papers)
          .map(([p, n]) => `${p}: ${n}`)
          .join(", ")}
        ). Every re-freeze is recorded with its reason and the files that changed, newest first.
      </p>
      {freeze.log.length ? (
        <Card>
          <ol className="divide-y divide-border">
            {freeze.log.map((e) => (
              <li key={e.at} className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[11rem_1fr] sm:px-5">
                <p className="tnum text-fg-3">
                  <time dateTime={e.at}>{formatStamp(e.at)}</time>
                </p>
                <div className="min-w-0">
                  <p className="text-fg">{e.reason}</p>
                  <p className="mt-0.5 text-xs text-fg-3">
                    {e.changed.length ? (
                      <>
                        Files changed:{" "}
                        {e.changed.map((f, i) => {
                          const id = f.match(/(DA\d{4}-S\d+-Q\d{2})\.json$/)?.[1];
                          return (
                            <span key={f}>
                              {i ? ", " : ""}
                              {id ? (
                                <Link href={`/questions/${id}`} className="font-mono text-accent-text hover:underline">
                                  {f}
                                </Link>
                              ) : (
                                <span className="font-mono">{f}</span>
                              )}
                            </span>
                          );
                        })}
                      </>
                    ) : (
                      "No question files changed."
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <p className="text-sm text-fg-3">The freeze log has no entries.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ disputes

export interface DisputeItem {
  id: string;
  label: string;
  decision: string;
  studentNote: string;
  resolvedAt: string;
  process: string[];
}

export interface OpenDisagreement {
  id: string;
  label: string;
  notes: string;
}

const DECISION_LABEL: Record<string, string> = {
  OFFICIAL_KEY_RETAINED_PREMISE_DEFECT_DOCUMENTED: "Official key retained; premise defect documented",
};

export function Disputes({ disputes, open }: { disputes: DisputeItem[]; open: OpenDisagreement[] }) {
  if (!disputes.length && !open.length) {
    return (
      <EmptyState title="No disputed official questions">
        Every official PYQ&apos;s independent re-solve agrees with the official key and no dispute record exists.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-2">
        The platform never changes an official answer. When independent solvers find a genuine problem with an official question, the evidence is adjudicated separately, the official key is kept,
        and students see a plain-English note after attempting the question.
      </p>
      {disputes.map((d) => (
        <Card key={d.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gavel aria-hidden className="h-4 w-4 text-fg-3" />
              <H3>
                <Link href={`/questions/${d.id}`} className="hover:underline">
                  {d.label}
                </Link>
              </H3>
            </div>
            <Badge tone="info">Resolved {formatDate(d.resolvedAt)}</Badge>
          </div>
          <dl className="mt-2 grid gap-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-fg-3">Question id</dt>
              <dd className="font-mono text-[0.85rem]">{d.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-fg-3">Decision</dt>
              <dd>{DECISION_LABEL[d.decision] ?? d.decision}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-fg-3">What students are told</dt>
              <dd className="text-fg-2">{d.studentNote}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-fg-3">Review stages</dt>
              <dd className="text-fg-2">{d.process.join(" → ")}</dd>
            </div>
          </dl>
          <Link href={`/questions/${d.id}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
            Open the question <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </Card>
      ))}
      {open.map((d) => (
        <Callout key={d.id} tone="warning" title={`${d.label}: independent re-solve disagrees with the official key (under review)`}>
          {d.notes}{" "}
          <Link href={`/questions/${d.id}`} className="underline">
            Open the question
          </Link>
        </Callout>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ original questions

export function OriginalMethod({ duplicateThreshold, pyqSimilarityThreshold, mocks }: { duplicateThreshold: number; pyqSimilarityThreshold: number; mocks: { planned: number; available: number; verifiedQuestions: number; plannedQuestions: number } }) {
  const gates: [string, string][] = [
    ["Metadata", "subject, topic and subtopic exist and agree; type, options and answer agree; marks are 1 or 2; option verdicts match the key"],
    ["Blueprint", "each mock question matches its planned slot: subject, topic, type, marks, section, number, and difficulty within one level"],
    ["Solution completeness", "quick summary, at least two worked steps, a final answer, and an analysis of all four options for MCQ/MSQ"],
    ["KaTeX formatting", "every formula renders, $ delimiters pair up, and no placeholder text is left"],
    ["Answer leaks", "the stem does not state the answer, no option is marked as correct, and all options are distinct"],
    ["Duplicates", `no near-duplicate of another original question (similarity below ${duplicateThreshold})`],
    ["Similarity to official PYQs", `not a copy or close paraphrase of any official question (similarity below ${pyqSimilarityThreshold})`],
    ["Edits after verification", "a question whose content changes after it was verified drops to NEEDS_REVIEW until it is re-verified"],
    ["Estimated time", "a plausible solving time for the marks"],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <ol className="space-y-4">
            <Step n={1} title="Author draft with a computational check" meta="Status afterwards: SELF_CHECKED">
              The author writes the question, the full solution and a Python check (or a recorded derivation for conceptual items).
            </Step>
            <Step n={2} title="Blind independent re-solve">
              A separate verifier solves the question without seeing the answer. The two answers must agree; an ambiguous question is rewritten until it has exactly one defensible answer.
            </Step>
            <Step n={3} title="Deterministic gates" meta="Identical for every question (scripts/content/mock-review.ts)">
              <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
                {gates.map(([name, what]) => (
                  <li key={name} className="rounded-md border border-border px-2.5 py-1.5">
                    <span className="font-medium text-fg">{name}:</span> {what}
                  </li>
                ))}
              </ul>
            </Step>
            <Step n={4} title="VERIFIED or NEEDS_REVIEW">
              A question that passes the re-solve and every gate is VERIFIED; anything else is NEEDS_REVIEW with the failing checks recorded.
            </Step>
          </ol>
        </CardBody>
      </Card>
      <Callout tone="info" title="A mock opens only when every one of its questions is VERIFIED">
        Until then, none of its questions appear anywhere on the platform: not in practice, search, “similar questions” or the question pages. Right now {mocks.available} of {mocks.planned} mocks are
        open ({mocks.verifiedQuestions} of {mocks.plannedQuestions} planned mock questions verified). Original practice questions are shown only once VERIFIED.
      </Callout>
    </div>
  );
}

// ------------------------------------------------------------------ status definitions

export function StatusDefinitions() {
  const verification: [ReactNode, string][] = [
    [<VerificationBadge key="v" status="VERIFIED" />, "Confirmed directly against the official source (or, for a question, every check passed and an independent verifier agreed)."],
    [<VerificationBadge key="p" status="PARTIALLY_VERIFIED" />, "Supported by strong evidence, but one link in the chain could not be checked directly, for example the official host could not be reached, so a hash-identical mirror was used."],
    [<VerificationBadge key="n" status="NEEDS_REVIEW" />, "Evidence is weak, secondary or conflicting. Treat it with caution until it is re-checked."],
  ];
  const review: [string, string][] = [
    ["DRAFT", "Written, but without the author's computational check yet. Never shown to students."],
    ["SELF_CHECKED", "The author's Python check or derivation is recorded; waiting for the blind independent re-solve. Never shown to students."],
    ["VERIFIED", "Passed the blind independent re-solve and every deterministic gate."],
    ["NEEDS_REVIEW", "The verifier or a gate flagged a problem; the question is held back until it is fixed and re-verified."],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <H3>Verification status (sources, facts, questions)</H3>
        <dl className="mt-3 space-y-3">
          {verification.map(([badge, text], i) => (
            <div key={i} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
              <dt>{badge}</dt>
              <dd className="text-sm text-fg-2">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-fg-3">
          A question&apos;s badge is the weakest of its source, transcription, answer and solution statuses. That is why official PYQs show “Partially verified” even when their transcription, answer and
          solution are all verified: the official source files themselves are partially verified (see below).
        </p>
      </Card>
      <Card className="p-4">
        <H3>Review status (original mock and practice questions)</H3>
        <dl className="mt-3 space-y-3">
          {review.map(([s, text]) => (
            <div key={s} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
              <dt>
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold text-fg">{s}</code>
              </dt>
              <dd className="text-sm text-fg-2">{text}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="lg:col-span-2">
        <Callout tone="warning" title="Why the official sources are “partially verified”">
          The official GATE hosts (gate2024.iisc.ac.in, gate2025.iitr.ac.in, gate2026.iitg.ac.in) could not be reached from the environment the content was built in. The files were therefore taken from
          public mirrors, and each one is byte-identical (same SHA-256) in two independent repositories. The official URLs are recorded so anyone can compare: running <Mono>npm run sources:verify</Mono>{" "}
          from a network that reaches the official hosts re-downloads each file, compares its hash and upgrades the source to verified when it matches.
        </Callout>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ rubric, mastery, weightage

const RUBRIC: { level: keyof typeof DIFFICULTY_LABEL; criteria: string }[] = [
  { level: "EASY", criteria: "One concept; direct recall or a single-step computation; at most 1.5 minutes for a prepared student." },
  { level: "MODERATE", criteria: "One concept with 2–3 steps, or two directly linked concepts; routine computation; 1.5–3 minutes." },
  { level: "HARD", criteria: "Several concepts or a non-routine insight; careful case analysis or lengthy computation; a likely trap; 3–5 minutes." },
  { level: "VERY_HARD", criteria: "Multi-concept synthesis that needs a non-obvious insight and error-prone computation; more than 5 minutes for most students." },
];

export function Rubrics({ halfLifeDays, minAttempts, papers, confidence }: { halfLifeDays: number; minAttempts: number; papers: number; confidence: string }) {
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <H3>Difficulty rubric (platform-estimated)</H3>
        <p className="mt-1 text-sm text-fg-2">GATE publishes no difficulty levels, so every difficulty label on this platform is an estimate with a one-sentence rationale naming the criteria it meets.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Difficulty rubric</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-fg-3">
                <th scope="col" className="w-32 py-2 pr-4 font-medium">
                  Level
                </th>
                <th scope="col" className="py-2 font-medium">
                  Criteria
                </th>
              </tr>
            </thead>
            <tbody>
              {RUBRIC.map((r) => (
                <tr key={r.level} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {DIFFICULTY_LABEL[r.level]}
                  </th>
                  <td className="py-2 text-fg-2">{r.criteria}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-fg-3">An MSQ whose four statements each need independent, non-trivial checking moves up one level. Source: docs/content-authoring.md, section 7.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <H3>Your topic mastery</H3>
          <p className="mt-1 text-sm text-fg-2">A 0–100 score computed only from your own attempts on this device. It is not an official GATE metric and never predicts a score or rank.</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="tnum w-12 shrink-0 font-semibold text-fg">60%</span>
              <span className="text-fg-2">Recency-weighted accuracy: each attempt&apos;s weight halves every {halfLifeDays} days.</span>
            </li>
            <li className="flex gap-3">
              <span className="tnum w-12 shrink-0 font-semibold text-fg">25%</span>
              <span className="text-fg-2">PYQ coverage: the share of the topic&apos;s official PYQs you have attempted (if the topic has no PYQs, this weight moves to accuracy).</span>
            </li>
            <li className="flex gap-3">
              <span className="tnum w-12 shrink-0 font-semibold text-fg">15%</span>
              <span className="text-fg-2">Revision health: the share of the topic&apos;s revision items that are not overdue and were last graded “almost” or “got it” (if there are none, this weight moves to accuracy).</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-fg-3">
            Fewer than {minAttempts} scored attempts in a topic shows “Not enough data”. Levels: Needs work (&lt; 40), Developing (40–69), Proficient (70–84), Strong (85+).
          </p>
        </Card>
        <Card className="p-4">
          <H3>Historical weightage</H3>
          <p className="mt-1 text-sm text-fg-2">
            Computed only from classified official PYQs, one paper at a time: questions and marks per subject and topic in each paper, then the minimum, maximum and mean across papers and each
            subject&apos;s share of all marks.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fg-2">
            <li>Papers are never pooled anonymously; every figure can be traced to a paper.</li>
            <li>Year-to-year variation is the coefficient of variation of marks: Low (&lt; 0.2), Medium (0.2–0.4), High (≥ 0.4), or “Insufficient data” with fewer than two papers.</li>
            <li>It is labelled a historical estimate. It describes past papers and does not predict the next one.</li>
          </ul>
          <p className="mt-3 text-sm text-fg-3">
            Current basis: {plural(papers, "paper")}. {confidence}
          </p>
          <Link href="/weightage" className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
            See the weightage page <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
