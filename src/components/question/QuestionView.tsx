"use client";
/**
 * The full question experience:
 *   attempt → submit → result → solution (quick / detailed / teaching) →
 *   concept → related formulas → similar questions → revision / error log.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, ExternalLink, Eye, NotebookPen, RotateCcw, ShieldCheck, Image as ImageIcon } from "lucide-react";
import type { QuestionPayload } from "@/lib/server/payload";
import { AnswerInput } from "./AnswerInput";
import { SolutionPanel } from "./SolutionPanel";
import { ErrorLogDialog } from "./ErrorLogDialog";
import { DifficultyBadge, OriginBadge, TypeBadge, VerificationBadge } from "./badges";
import { RichHtml } from "@/components/ui/RichHtml";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { BookmarkButton } from "@/components/userdata/BookmarkButton";
import { formatAnswer, formatResponse, isResponseEmpty, scoreQuestion, type UserResponse } from "@/lib/scoring/score";
import { useMockAttempts, useSetting, useUserData } from "@/lib/userdata/hooks";
import { addErrorLog, addToRevision, recordAttemptWithFollowUps } from "@/lib/userdata/ops";
import type { AttemptContext } from "@/lib/userdata/db";
import { formatDate, formatMarks, cn } from "@/lib/utils";
import { SLOT_LABEL, TYPE_HELP, VERIFICATION_LABEL } from "@/lib/labels";

export interface QuestionViewProps {
  q: QuestionPayload;
  context?: AttemptContext;
  /** Called after the student submits (used by practice sessions to enable "Next"). */
  onSubmitted?: (result: { status: string; marks: number }) => void;
  /** Hide the related/similar section (e.g. inside compact sessions). */
  compact?: boolean;
  headingLevel?: "h1" | "h2";
}

export function questionTitle(q: Pick<QuestionPayload, "origin" | "year" | "questionNumber" | "topicName" | "testId">) {
  if (q.origin === "OFFICIAL_PYQ") return `GATE DA ${q.year} · Q.${q.questionNumber}`;
  if (q.origin === "MOCK_TEST") return `Mock ${Number(q.testId?.slice(5))} · Q.${q.questionNumber}`;
  return `Practice · ${q.topicName}`;
}

/** Keyed by question id so all per-question state resets when the question changes. */
export function QuestionView(props: QuestionViewProps) {
  return <QuestionViewInner key={props.q.id} {...props} />;
}

function QuestionViewInner({ q, context = "pyq", onSubmitted, compact = false, headingLevel = "h1" }: QuestionViewProps) {
  const { db } = useUserData();
  const [response, setResponse] = useState<UserResponse | null>(null);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | undefined>();
  const [phase, setPhase] = useState<"attempt" | "submitted" | "revealed">("attempt");
  const [result, setResult] = useState<{ status: string; marks: number } | null>(null);
  const [errorDialog, setErrorDialog] = useState(false);
  const [showOfficial, setShowOfficial] = useState(false);
  const [revisionAdded, setRevisionAdded] = useState(false);
  const [errorLogged, setErrorLogged] = useState(false);
  const [autoErrorLog] = useSetting("autoErrorLog", true);
  const started = useRef<number>(0);
  const mockAttempts = useMockAttempts();
  const takenMocks = useMemo(() => new Set(mockAttempts.filter((m) => m.status === "submitted").map((m) => m.testId)), [mockAttempts]);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  const title = questionTitle(q);
  const H = headingLevel;
  const isMta = q.answer.kind === "MTA";

  async function submit() {
    const elapsed = Math.round(performance.now() - started.current);
    const s = scoreQuestion(q, response, { negativeMarking: true, mtaPolicy: "exclude" });
    setResult({ status: s.status, marks: s.marks });
    setPhase("submitted");
    onSubmitted?.({ status: s.status, marks: s.marks });
    if (!db) return;
    const attemptId = await recordAttemptWithFollowUps(
      db,
      {
        questionId: q.id,
        origin: q.origin,
        subjectId: q.subjectId,
        topicId: q.topicId,
        context,
        response,
        status: s.status,
        marksAwarded: s.marks,
        maxMarks: s.maxMarks,
        timeSpentMs: elapsed,
        confidence,
      },
      { title },
    );
    if (s.status === "incorrect") {
      setRevisionAdded(true);
      if (autoErrorLog) {
        await addErrorLog(db, {
          questionId: q.id,
          origin: q.origin,
          subjectId: q.subjectId,
          topicId: q.topicId,
          title,
          yourAnswer: formatResponse(response),
          correctAnswer: formatAnswer(q.answer),
          attemptId,
          correctConcept: q.concepts[0]?.title ?? q.topicName,
        });
        setErrorLogged(true);
      }
    }
  }

  const done = phase !== "attempt";
  const similar = q.similar.filter((s) => s.origin !== "MOCK_TEST" || (s.testId && takenMocks.has(s.testId))).slice(0, 5);

  return (
    <article aria-labelledby={`q-title-${q.id}`} className="space-y-6">
      {/* ---------------------------------------------------------- header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <OriginBadge origin={q.origin} />
          <TypeBadge type={q.type} marks={q.marks} />
          <DifficultyBadge difficulty={q.difficulty} />
          <VerificationBadge status={q.verification} />
        </div>
        <H id={`q-title-${q.id}`} className={cn("font-semibold tracking-tight text-fg", H === "h1" ? "text-xl sm:text-2xl" : "text-lg")}>
          {title}
        </H>
        {q.origin === "OFFICIAL_PYQ" && q.paper ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Meta label="Exam date" value={formatDate(q.paper.examDate)} />
            <Meta label="Session / slot" value={`Session ${q.paper.session} · ${SLOT_LABEL[q.paper.slot] ?? q.paper.slot}`} />
            <Meta label="Question" value={`Q.${q.questionNumber} (${q.section})`} />
            <Meta label="Organizing institute" value={q.paper.organizingInstitute} />
          </dl>
        ) : null}
        <p className="text-sm text-fg-3">
          <Link href={`/subjects/${q.subjectId}`} className="hover:underline">
            {q.subjectName}
          </Link>{" "}
          ›{" "}
          <Link href={`/subjects/${q.subjectId}/topics/${q.topicId}`} className="hover:underline">
            {q.topicName}
          </Link>
          {q.subtopicNames.length ? ` › ${q.subtopicNames.join(", ")}` : null}
        </p>
      </header>

      {/* ---------------------------------------------------------- question */}
      <section aria-label="Question" className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)] sm:p-6">
        <RichHtml html={q.html.stem} className="text-[1.02rem]" />
        <p className="mt-4 text-xs text-fg-3">{TYPE_HELP[q.type]}</p>
        <div className="mt-3">
          <AnswerInput questionId={q.id} type={q.type} options={q.html.options} value={response} onChange={setResponse} reveal={done ? q.answer : null} />
        </div>

        {!done ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <fieldset className="flex flex-wrap items-center gap-2 text-sm">
              <legend className="sr-only">Confidence before checking (optional)</legend>
              <span className="text-fg-3">Confidence:</span>
              {(["high", "medium", "low"] as const).map((c) => (
                <label key={c} className="cursor-pointer rounded-md border border-border px-2 py-1 text-fg-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-text">
                  <input type="radio" name={`conf-${q.id}`} className="sr-only" checked={confidence === c} onChange={() => setConfidence(c)} />
                  {c[0].toUpperCase() + c.slice(1)}
                </label>
              ))}
            </fieldset>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setPhase("revealed")}>
                <Eye aria-hidden className="h-4 w-4" /> Reveal answer
              </Button>
              <Button variant="primary" onClick={submit} disabled={isResponseEmpty(response)}>
                Submit answer
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "submitted" && result ? (
          <div
            role="status"
            className={cn(
              "mt-5 rounded-lg px-4 py-3 text-sm font-medium",
              result.status === "correct" && "bg-success-soft text-success",
              result.status === "incorrect" && "bg-danger-soft text-danger",
              result.status === "not_scored" && "bg-warning-soft text-warning",
            )}
          >
            {result.status === "correct" && `Correct: +${formatMarks(result.marks)} mark${result.marks === 1 ? "" : "s"}.`}
            {result.status === "incorrect" &&
              `Incorrect: ${result.marks < 0 ? `${formatMarks(result.marks)} (GATE negative marking for MCQ)` : "0 marks (no negative marking for MSQ/NAT)"}. Your answer: ${formatResponse(response)}.`}
            {result.status === "not_scored" && "The official key awarded marks to all candidates for this question, so it is not scored here."}
          </div>
        ) : null}
        {phase === "submitted" && result?.status === "incorrect" ? (
          <WrongAnswerLearning q={q} response={response} />
        ) : null}
        {phase === "revealed" ? (
          <p role="status" className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-2">
            Answer revealed without an attempt. Nothing was recorded.
          </p>
        ) : null}
        {done && q.origin === "OFFICIAL_PYQ" && !q.answerVerification.agreesWithKey ? (
          <Callout tone="warning" className="mt-4" title="Disputed question: official key retained, under review">
            <p>
              The platform keeps the official answer <strong>({q.officialKeyRaw})</strong> from the official answer key. Its independent re-solve found a possible ambiguity:
            </p>
            <p className="mt-1">{q.answerVerification.notes}</p>
            {q.answerVerification.independentAnswer ? <p className="mt-1">Platform analysis: {q.answerVerification.independentAnswer}</p> : null}
            {q.sources.find((s) => s.type === "OFFICIAL_ANSWER_KEY")?.url ? (
              <p className="mt-1">
                Source:{" "}
                <a className="underline" href={q.sources.find((s) => s.type === "OFFICIAL_ANSWER_KEY")!.url} target="_blank" rel="noopener noreferrer">
                  {q.sources.find((s) => s.type === "OFFICIAL_ANSWER_KEY")!.name}
                </a>
              </p>
            ) : null}
          </Callout>
        ) : null}
        {isMta && done ? (
          <Callout tone="warning" className="mt-4" title="Marks to all (official key)">
            The official final answer key awarded marks to all candidates for this question. The solution below analyses the question as printed.
          </Callout>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- actions */}
      <div className="flex flex-wrap gap-2">
        <BookmarkButton kind="question" refId={q.id} title={title} subjectId={q.subjectId} snapshot={{ html: q.html.stem, href: `/questions/${q.id}` }} />
        <Button
          size="sm"
          className="h-[34px]"
          disabled={!db || revisionAdded}
          onClick={async () => {
            if (!db) return;
            await addToRevision(db, { kind: "question", refId: q.id, title, subjectId: q.subjectId, topicId: q.topicId, reason: "difficult" });
            setRevisionAdded(true);
          }}
        >
          <RotateCcw aria-hidden className="h-4 w-4" /> {revisionAdded ? "In revision queue" : "Add to revision"}
        </Button>
        <Button size="sm" className="h-[34px]" disabled={!db} onClick={() => setErrorDialog(true)}>
          <NotebookPen aria-hidden className="h-4 w-4" /> {errorLogged ? "Classify mistake" : "Add to error log"}
        </Button>
        {q.origin === "OFFICIAL_PYQ" && q.sources[0]?.url ? (
          <a href={q.sources[0].url} target="_blank" rel="noopener noreferrer" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium text-fg-2 hover:bg-surface-2">
            <ExternalLink aria-hidden className="h-4 w-4" /> View source
          </a>
        ) : null}
        {q.officialImages?.length ? (
          <Button size="sm" className="h-[34px]" onClick={() => setShowOfficial((v) => !v)} aria-expanded={showOfficial}>
            <ImageIcon aria-hidden className="h-4 w-4" /> {showOfficial ? "Hide" : "Compare with"} official rendering
          </Button>
        ) : null}
      </div>
      {errorLogged ? (
        <p className="-mt-3 text-sm text-fg-3">
          Added to your <Link href="/errors" className="underline">error log</Link> and today&apos;s <Link href="/revision" className="underline">revision queue</Link>. Classify the mistake type to track patterns.
        </p>
      ) : null}

      {showOfficial && q.officialImages?.length ? (
        <figure className="space-y-2 rounded-[var(--radius)] border border-border bg-surface p-3">
          {q.officialImages.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt={`Official paper rendering of ${title}`} loading="lazy" className="w-full rounded border border-border bg-white" />
          ))}
          <figcaption className="text-xs text-fg-3">
            Rendered from the official master question paper ({q.sources[0]?.name}) for side-by-side checking of the transcription.
          </figcaption>
        </figure>
      ) : null}

      {/* ---------------------------------------------------------- solution */}
      {done ? (
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)] sm:p-6">
          <SolutionPanel html={q.html} correctAnswerText={formatAnswer(q.answer)} />
        </div>
      ) : null}

      {done && !compact ? (
        <>
          {/* Learn this concept */}
          <section aria-labelledby={`learn-${q.id}`} className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
              <h2 id={`learn-${q.id}`} className="mb-2 flex items-center gap-2 font-semibold text-fg">
                <BookOpenCheck aria-hidden className="h-4 w-4 text-accent" /> Learn this concept
              </h2>
              {q.concepts.length ? (
                <ul className="space-y-1.5">
                  {q.concepts.map((c) => (
                    <li key={c.id}>
                      <Link href={`/concepts/${c.id}`} className="text-sm font-medium text-accent-text hover:underline">
                        {c.title} →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link href={`/subjects/${q.subjectId}/topics/${q.topicId}`} className="text-sm font-medium text-accent-text hover:underline">
                  Study {q.topicName} →
                </Link>
              )}
              {q.concept ? <p className="mt-2 text-sm text-fg-3">Concept tested: {q.concept}</p> : null}
            </div>
            <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
              <h2 className="mb-2 font-semibold text-fg">Related formulas</h2>
              {q.formulas.length ? (
                <ul className="space-y-2">
                  {q.formulas.slice(0, 3).map((f) => (
                    <li key={f.id} className="rounded-md bg-surface-2 px-3 py-2">
                      <Link href={`/formulas/${f.subjectId}#${f.id}`} className="text-sm font-medium text-fg hover:underline">
                        {f.name}
                      </Link>
                      <RichHtml html={f.html} className="text-sm" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">No formula card is linked to this topic.</p>
              )}
            </div>
          </section>

          {/* Similar questions */}
          <section aria-labelledby={`similar-${q.id}`}>
            <h2 id={`similar-${q.id}`} className="mb-2 font-semibold text-fg">
              Similar questions
            </h2>
            {similar.length ? (
              <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link href={`/questions/${s.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex shrink-0 flex-wrap gap-1.5">
                        <OriginBadge origin={s.origin} />
                        <Badge tone="outline">{s.type}</Badge>
                        {s.year ? <Badge tone="outline">{s.year} · Q.{s.questionNumber}</Badge> : null}
                      </span>
                      <span className="line-clamp-2 min-w-0 text-sm text-fg-2">{s.preview}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-3">No similar questions are available yet. Questions from a mock test appear here once you have taken that mock.</p>
            )}
          </section>

          {/* Verification */}
          <details className="rounded-[var(--radius)] border border-border bg-surface p-4 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-fg">
              <ShieldCheck aria-hidden className="h-4 w-4 text-success" /> Source &amp; verification details
            </summary>
            <div className="mt-3 space-y-3 text-fg-2">
              {q.origin === "OFFICIAL_PYQ" ? (
                <>
                  <p>
                    <strong className="text-fg">Official key:</strong> <code>{q.officialKeyRaw}</code>. Answer verification: {VERIFICATION_LABEL[q.answerVerification.status]}
                    {q.answerVerification.method ? `, ${q.answerVerification.method}.` : "."}
                  </p>
                  {q.transcription ? (
                    <p>
                      <strong className="text-fg">Transcription:</strong> {VERIFICATION_LABEL[q.transcription.status]}. {q.transcription.notes}
                    </p>
                  ) : null}
                  {q.paper ? (
                    <p>
                      <strong className="text-fg">Date &amp; slot:</strong> {VERIFICATION_LABEL[q.paper.scheduleStatus as keyof typeof VERIFICATION_LABEL] ?? q.paper.scheduleStatus}. {q.paper.scheduleNotes}
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  <strong className="text-fg">Original question</strong> written for this platform. It is not an official GATE question. Answer verification: {VERIFICATION_LABEL[q.answerVerification.status]}. {q.answerVerification.method}
                </p>
              )}
              <p>
                <strong className="text-fg">Difficulty:</strong> {q.difficultyRationale}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {q.sources.map((s) => (
                  <li key={s.id}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-text underline">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}{" "}
                    ({VERIFICATION_LABEL[s.verificationStatus as keyof typeof VERIFICATION_LABEL] ?? s.verificationStatus}): {s.verificationNotes}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </>
      ) : null}

      <ErrorLogDialog
        open={errorDialog}
        onOpenChange={setErrorDialog}
        defaultConcept={q.concepts[0]?.title ?? q.topicName}
        onSave={async (v) => {
          if (!db) return;
          await addErrorLog(db, {
            questionId: q.id,
            origin: q.origin,
            subjectId: q.subjectId,
            topicId: q.topicId,
            title,
            yourAnswer: formatResponse(response),
            correctAnswer: formatAnswer(q.answer),
            mistakeType: v.mistakeType,
            note: v.note,
            correctConcept: v.correctConcept,
          });
          setErrorLogged(true);
        }}
      />
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className="truncate font-medium text-fg">{value}</dd>
    </div>
  );
}

/** Shown after an incorrect answer: why the chosen answer is wrong and where to practise. */
function WrongAnswerLearning({ q, response }: { q: QuestionPayload; response: UserResponse | null }) {
  const chosen = response?.kind === "MCQ" ? [response.choice] : response?.kind === "MSQ" ? response.choices : [];
  const correct = q.answer.kind === "MCQ" ? [q.answer.correct] : q.answer.kind === "MSQ" ? q.answer.correct : [];
  const wrongPicks = (q.html.optionAnalysis ?? []).filter((o) => chosen.includes(o.label) && o.verdict === "incorrect");
  const missed = (q.html.optionAnalysis ?? []).filter((o) => !chosen.includes(o.label) && correct.includes(o.label));
  return (
    <section aria-label="Learn from this mistake" className="mt-4 space-y-3 rounded-lg border border-danger/30 bg-surface p-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-fg-3">Your answer</dt>
          <dd className="font-semibold text-danger">{formatResponse(response)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Correct answer</dt>
          <dd className="font-semibold text-success">{formatAnswer(q.answer)}</dd>
        </div>
      </dl>
      {wrongPicks.length || missed.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-fg">Why your answer is wrong</p>
          <ul className="space-y-2">
            {wrongPicks.map((o) => (
              <li key={o.label} className="flex gap-2 text-sm">
                <span className="w-24 shrink-0 font-semibold text-danger">({o.label}) chosen</span>
                <RichHtml html={o.html} className="min-w-0 flex-1 text-sm" />
              </li>
            ))}
            {missed.map((o) => (
              <li key={o.label} className="flex gap-2 text-sm">
                <span className="w-24 shrink-0 font-semibold text-success">({o.label}) missed</span>
                <RichHtml html={o.html} className="min-w-0 flex-1 text-sm" />
              </li>
            ))}
          </ul>
        </div>
      ) : q.html.commonTrap ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-fg">Likely reason</p>
          <RichHtml html={q.html.commonTrap} className="text-sm" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg-3">Concept tested:</span>
        {q.concepts.length ? (
          q.concepts.slice(0, 2).map((c) => (
            <Link key={c.id} href={`/concepts/${c.id}`} className="font-medium text-accent-text underline">
              {c.title}
            </Link>
          ))
        ) : (
          <Link href={`/subjects/${q.subjectId}/topics/${q.topicId}`} className="font-medium text-accent-text underline">
            {q.concept ?? q.topicName}
          </Link>
        )}
        <Link href={`/practice?subject=${q.subjectId}&topic=${q.topicId}&count=5`} className="ml-auto inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-medium text-white dark:text-[#0e1117]">
          Practice this concept
        </Link>
      </div>
    </section>
  );
}
