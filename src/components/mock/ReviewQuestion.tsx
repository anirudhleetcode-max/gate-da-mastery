"use client";
/**
 * Read-only review of one mock question after submission: the stem, the
 * student's response against the correct answer, marks awarded, time and
 * confidence, and the full solution. Unlike QuestionView it records nothing.
 */
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, CircleSlash, Clock3, ExternalLink, Flag, XCircle } from "lucide-react";
import type { QuestionPayload } from "@/lib/server/payload";
import type { MockQuestionState } from "@/lib/userdata/db";
import type { ScoredQuestion } from "@/lib/mock/analysis";
import { STATUS_LABEL } from "@/lib/mock/analysis";
import { formatSeconds, signedMarks } from "@/lib/mock/format";
import { CONFIDENCE_LABEL } from "@/lib/mock/types";
import { formatAnswer, formatResponse } from "@/lib/scoring/score";
import { AnswerInput } from "@/components/question/AnswerInput";
import { SolutionPanel } from "@/components/question/SolutionPanel";
import { DifficultyBadge, OriginBadge, TypeBadge, VerificationBadge } from "@/components/question/badges";
import { RichHtml } from "@/components/ui/RichHtml";
import { cn } from "@/lib/utils";

const noop = () => {};

export function StatusIcon({ status, className }: { status: ScoredQuestion["status"]; className?: string }) {
  const Icon = status === "correct" ? CheckCircle2 : status === "incorrect" ? XCircle : CircleSlash;
  return <Icon aria-hidden className={cn("h-4 w-4 shrink-0", status === "correct" ? "text-success" : status === "incorrect" ? "text-danger" : "text-fg-3", className)} />;
}

export function ReviewQuestion({ q, item, state }: { q: QuestionPayload; item: ScoredQuestion; state: MockQuestionState | undefined }) {
  const response = state?.response ?? null;
  const tone = item.status === "correct" ? "border-success/30 bg-success-soft" : item.status === "incorrect" ? "border-danger/30 bg-danger-soft" : "border-border bg-surface-2";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <OriginBadge origin={q.origin} />
        <TypeBadge type={q.type} marks={q.marks} />
        <DifficultyBadge difficulty={q.difficulty} />
        <VerificationBadge status={q.verification} />
      </div>
      <p className="text-sm text-fg-3">
        {q.subjectName} › {q.topicName}
        {q.subtopicNames.length ? ` › ${q.subtopicNames.join(", ")}` : null}
      </p>

      <RichHtml html={q.html.stem} className="text-[1.02rem]" />
      <AnswerInput questionId={`review-${q.id}`} type={q.type} options={q.html.options} value={response} onChange={noop} reveal={q.answer} />

      <dl className={cn("grid gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4", tone)}>
        <div>
          <dt className="text-xs text-fg-3">Result</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-fg">
            <StatusIcon status={item.status} />
            {STATUS_LABEL[item.status]} · <span className="tnum">{signedMarks(item.awarded)}</span>
            {item.status === "incorrect" && item.awarded < 0 ? <span className="font-normal text-fg-2">(negative marking)</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Your answer / correct answer</dt>
          <dd className="tnum font-medium text-fg">
            {formatResponse(response)} <span className="text-fg-3">/</span> {formatAnswer(q.answer)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Your time / estimate</dt>
          <dd className="tnum flex items-center gap-1.5 font-medium text-fg">
            <Clock3 aria-hidden className="h-3.5 w-3.5 text-fg-3" />
            {formatSeconds(item.timeSpentMs / 1000)} / {formatSeconds(item.estimatedTimeSec)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Confidence · review mark</dt>
          <dd className="flex items-center gap-1.5 font-medium text-fg">
            {item.confidence ? CONFIDENCE_LABEL[item.confidence] : "Not recorded"}
            {item.markedForReview ? (
              <span className="inline-flex items-center gap-1 text-fg-2">
                · <Flag aria-hidden className="h-3.5 w-3.5" /> Marked
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="border-t border-border pt-4 sm:rounded-[var(--radius)] sm:border sm:bg-surface sm:p-5">
        <SolutionPanel html={q.html} correctAnswerText={formatAnswer(q.answer)} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {q.concepts.map((c) => (
          <Link key={c.id} href={`/concepts/${c.id}`} className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
            <BookOpenCheck aria-hidden className="h-4 w-4" /> Concept: {c.title}
          </Link>
        ))}
        <Link href={`/subjects/${q.subjectId}/topics/${q.topicId}`} className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
          <BookOpenCheck aria-hidden className="h-4 w-4" /> Study {q.topicName}
        </Link>
        <Link href={`/questions/${q.id}`} className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
          <ExternalLink aria-hidden className="h-4 w-4" /> Question page: formulas and similar questions
        </Link>
      </div>
      {q.concept ? <p className="text-sm text-fg-3">Concept tested: {q.concept}</p> : null}
    </div>
  );
}
