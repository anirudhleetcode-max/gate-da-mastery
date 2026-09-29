/**
 * Presentational pieces shared by the subject, topic and syllabus pages.
 * Hook-free, so they render in server and client components alike.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import type { Mastery } from "@/lib/analytics/stats";
import { MASTERY_HALF_LIFE_DAYS, MASTERY_MIN_ATTEMPTS } from "@/lib/analytics/stats";
import { Badge } from "@/components/ui/Badge";
import { VerificationBadge } from "@/components/question/badges";
import { SUBJECT_COLOR } from "@/lib/labels";
import { cn, formatDate, formatMarks, pct, plural } from "@/lib/utils";
import type { SourceRef, WeightageSummary } from "./types";

export function SubjectDot({ id, className }: { id: SubjectId; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: SUBJECT_COLOR[id] }} />;
}

// ------------------------------------------------------------------ mastery

const MASTERY_TONE: Record<Mastery["level"], "success" | "info" | "warning" | "danger" | "neutral"> = {
  Strong: "success",
  Proficient: "info",
  Developing: "warning",
  "Needs work": "danger",
  "Not enough data": "neutral",
};

/** "Proficient · 72" or "Not enough data" (never a made-up number). */
export function MasteryBadge({ mastery, className }: { mastery: Mastery; className?: string }) {
  return (
    <Badge tone={MASTERY_TONE[mastery.level]} className={className} title={mastery.score === null ? `Needs at least ${MASTERY_MIN_ATTEMPTS} answered questions` : `Your topic mastery: ${mastery.score} of 100`}>
      {mastery.level}
      {mastery.score !== null ? <span className="tnum font-semibold">· {mastery.score}</span> : null}
    </Badge>
  );
}

/** Documented formula for "Your topic mastery" (mirrors topicMastery() in lib/analytics/stats.ts). */
export function MasteryMethod({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 text-sm text-fg-2", className)}>
      <p>
        <span className="font-medium text-fg">Your topic mastery</span> is a 0–100 score this platform computes from your own answers on this device. It is{" "}
        <span className="font-medium text-fg">not an official GATE metric</span> and does not predict marks or rank.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <span className="font-medium text-fg">60% recent accuracy</span>: your accuracy in the topic, with each answer weighted by recency (an answer {MASTERY_HALF_LIFE_DAYS} days old counts half as much as
          one from today).
        </li>
        <li>
          <span className="font-medium text-fg">25% PYQ coverage</span>: the share of the topic&apos;s official PYQs you have attempted. If the topic has no PYQs, this weight moves to accuracy.
        </li>
        <li>
          <span className="font-medium text-fg">15% revision health</span>: the share of the topic&apos;s revision items that are not overdue and were last graded &ldquo;Almost&rdquo; or &ldquo;Got it&rdquo;.
          With no revision items, this weight moves to accuracy.
        </li>
      </ul>
      <p>
        At least {MASTERY_MIN_ATTEMPTS} answered questions are needed; with fewer, the topic shows &ldquo;Not enough data&rdquo;. Levels: 85 and above Strong, 70–84 Proficient, 40–69 Developing, below 40
        Needs work.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ small metric

export function Metric({ label, value, hint, children, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius)] border border-border bg-surface px-4 py-3", className)}>
      <div className="text-xs font-medium text-fg-3">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold text-fg">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-fg-3">{hint}</div> : null}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ official syllabus

export function SourceLinks({ sources, className }: { sources: SourceRef[]; className?: string }) {
  if (!sources.length) return <span className={className}>No source recorded.</span>;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {sources.map((s) => (
        <li key={s.id}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
              {s.name}
              <span className="sr-only"> (official document, opens in a new tab)</span>
              <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          ) : (
            <span>{s.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The official syllabus text exactly as published, with provenance. */
export function OfficialSyllabusText({
  heading,
  text,
  status,
  sources,
  headingLevel: H = "h3",
  className,
}: {
  heading: string;
  text: string;
  status: SourceRef["status"];
  sources: SourceRef[];
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <H className="text-sm font-semibold text-fg">
          <span className="sr-only">Official syllabus section: </span>
          {heading}
        </H>
        <VerificationBadge status={status} />
      </div>
      <blockquote className="space-y-2 border-l-2 border-border-strong pl-3 text-[0.94rem] leading-relaxed text-fg" cite={sources.find((s) => s.url)?.url}>
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </blockquote>
      <div className="space-y-1 text-xs text-fg-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>Verbatim from:</span>
          <SourceLinks sources={sources} />
        </div>
        <Link href="/sources" className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> How the syllabus was verified
        </Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ weightage

const VARIATION_HELP: Record<WeightageSummary["variation"], string> = {
  Low: "marks were similar in every paper",
  Medium: "marks moved noticeably between papers",
  High: "marks changed a lot between papers",
  "Insufficient data": "too few papers to judge",
};

export function variationTone(v: WeightageSummary["variation"]) {
  return v === "Low" ? "success" : v === "Medium" ? "warning" : v === "High" ? "danger" : "neutral";
}

/** "9–13 marks" or "15 marks" when every paper had the same. */
export function marksRange(min: number, max: number) {
  return min === max ? `${formatMarks(min)} marks` : `${formatMarks(min)}–${formatMarks(max)} marks`;
}

/** Per-paper marks and questions for one subject, labelled as a historical estimate. */
export function WeightageTable({ w, subjectName }: { w: WeightageSummary; subjectName: string }) {
  const incomplete = w.loadedQuestions < w.paperQuestions;
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-2">
        <span className="tnum font-semibold text-fg">{marksRange(w.marksMin, w.marksMax)}</span> per paper across {plural(w.totalPapers, "official paper")} (mean{" "}
        <span className="tnum">{formatMarks(w.marksMean)}</span>); {subjectName} appeared in {w.papersAppeared} of {w.totalPapers}.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Historical estimate: {subjectName} questions and marks in each official GATE DA paper</caption>
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs text-fg-3">
              <th scope="col" className="px-3 py-2 font-medium">
                Paper
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Questions
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Marks
              </th>
              <th scope="col" className="hidden whitespace-nowrap px-3 py-2 text-right font-medium sm:table-cell">
                MCQ / MSQ / NAT
              </th>
            </tr>
          </thead>
          <tbody>
            {w.rows.map((r) => (
              <tr key={r.paperId} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                  <Link href={`/pyqs/papers/${r.paperId}`} className="hover:underline">
                    GATE {r.year}
                  </Link>
                  <span className="block text-xs font-normal text-fg-3">
                    {r.examDate ? formatDate(r.examDate) : ""}
                    {r.session ? ` · Session ${r.session}` : ""}
                    {r.paperLoaded < r.paperTotal ? ` · ${r.paperLoaded} of ${r.paperTotal} classified` : ""}
                  </span>
                  <span className="tnum block text-xs font-normal text-fg-3 sm:hidden">
                    MCQ {r.byType.MCQ} · MSQ {r.byType.MSQ} · NAT {r.byType.NAT}
                  </span>
                </th>
                <td className="tnum px-3 py-2 text-right text-fg-2">{r.questions}</td>
                <td className="tnum px-3 py-2 text-right font-semibold text-fg">{formatMarks(r.marks)}</td>
                <td className="tnum hidden px-3 py-2 text-right text-fg-3 sm:table-cell">
                  {r.byType.MCQ} / {r.byType.MSQ} / {r.byType.NAT}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg-3">Year-to-year variation:</span>
        <Badge tone={variationTone(w.variation)}>{w.variation}</Badge>
        <span className="text-xs text-fg-3">
          {VARIATION_HELP[w.variation]}
          {w.marksCv !== null ? ` (coefficient of variation ${w.marksCv.toFixed(2)})` : ""}
        </span>
      </div>
      <p className="text-xs text-fg-3">
        {w.confidenceNote}
        {incomplete
          ? ` Only the ${w.loadedQuestions} of ${w.paperQuestions} official questions from these papers that are classified in the question bank are counted, so the figures can still change.`
          : ""}{" "}
        Historical figures describe past papers; they are not a prediction.{" "}
        <Link href="/weightage" className="font-medium text-accent-text hover:underline">
          All subjects&apos; weightage
        </Link>
      </p>
    </div>
  );
}

/** Visible integrity note for question lists: difficulty badges are the platform's estimate. */
export function DifficultyNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-fg-3", className)}>Difficulty labels are platform estimates; GATE does not publish difficulty levels.</p>;
}

// ------------------------------------------------------------------ accuracy text

/** "67% (8 of 12)" / "—" with an honest sr-only explanation. */
export function AccuracyValue({ correct, attempted }: { correct: number; attempted: number }) {
  if (!attempted)
    return (
      <span className="text-fg-3">
        —<span className="sr-only">no answers yet</span>
      </span>
    );
  return (
    <span className="tnum">
      {pct(correct / attempted, 0)}
      <span className="text-xs font-normal text-fg-3">
        {" "}
        ({correct}/{attempted})
      </span>
    </span>
  );
}
