import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ExternalLink, FilePen } from "lucide-react";
import { getMock, getQuestion, getQuestionUnchecked, getSubject, getTopic } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { ServerRichHtml } from "@/components/ui/ServerRichHtml";
import { ButtonLink } from "@/components/ui/Button";
import { DifficultyBadge, OriginBadge, TypeBadge, VerificationBadge } from "@/components/question/badges";
import { isAdminEnabled } from "@/components/insights/admin/access";
import { editHref, questionFileIndex } from "@/components/insights/admin/data";
import { ReviewBadge } from "@/components/insights/admin/parts";
import { formatAnswer } from "@/lib/scoring/score";
import { VERIFICATION_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Question preview (admin)", robots: { index: false, follow: false } };

type Params = { params: Promise<{ id: string }> };

export default async function AdminQuestionPage({ params }: Params) {
  await connection();
  if (!isAdminEnabled()) notFound();
  const { id } = await params;
  const q = getQuestionUnchecked(decodeURIComponent(id));
  if (!q) notFound();
  const servable = getQuestion(q.id) !== undefined;
  const file = questionFileIndex().get(q.id);
  const mock = q.testId ? getMock(q.testId) : undefined;
  const av = q.answerVerification;

  return (
    <>
      <PageHeader
        title={q.id}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Questions", href: "/admin#questions" }, { label: q.id }]}
        description={`${getSubject(q.subjectId)?.name ?? q.subjectId} › ${getTopic(q.topicId)?.name ?? q.topicId}${mock ? ` · ${mock.title}` : ""}`}
        actions={
          <>
            {file ? (
              <ButtonLink href={editHref(file)}>
                <FilePen aria-hidden className="h-4 w-4" /> Edit file
              </ButtonLink>
            ) : null}
            {servable ? (
              <ButtonLink href={`/questions/${encodeURIComponent(q.id)}`}>
                <ExternalLink aria-hidden className="h-4 w-4" /> Student view
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          <OriginBadge origin={q.origin} />
          <TypeBadge type={q.type} marks={q.marks} />
          <DifficultyBadge difficulty={q.difficulty} />
          <VerificationBadge status={q.verification} />
          {q.reviewStatus ? <ReviewBadge status={q.reviewStatus} /> : null}
        </div>
        {!servable ? (
          <Callout tone="warning" title="Hidden from students">
            {q.origin === "MOCK_TEST"
              ? `Mock ${mock?.number ?? "?"} is not available yet (${mock?.verifiedCount ?? 0} of ${mock?.questionIds.length ?? "?"} questions verified), so this question is gated.`
              : "Only VERIFIED practice questions are shown to students."}{" "}
            This read-only preview is for review; nothing is recorded.
          </Callout>
        ) : null}

        <Card>
          <CardHeader title="Question" />
          <CardBody className="space-y-3">
            <ServerRichHtml html={q.html.stem} />
            {q.html.options.length ? (
              <ol className="space-y-2">
                {q.html.options.map((o) => (
                  <li key={o.label} className="flex gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="font-semibold text-fg-2">({o.label})</span>
                    <ServerRichHtml html={o.html} className="min-w-0 flex-1" />
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="text-sm">
              <span className="font-medium text-fg-3">Answer: </span>
              <span className="font-semibold text-success">{formatAnswer(q.answer)}</span>
              {q.officialKeyRaw ? <span className="text-fg-3"> · official key cell “{q.officialKeyRaw}”</span> : null}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Solution" description="Quick, detailed steps and teaching mode as stored." />
          <CardBody className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-fg-3">Quick</h3>
              <ServerRichHtml html={q.html.quick} />
            </div>
            <ol className="space-y-3">
              {q.html.steps.map((s, i) => (
                <li key={i} className="rounded-lg border border-border px-3 py-2">
                  <p className="mb-1 font-semibold">
                    {i + 1}. {s.title}
                  </p>
                  <ServerRichHtml html={s.html} />
                </li>
              ))}
            </ol>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-fg-3">Final answer</h3>
              <ServerRichHtml html={q.html.finalAnswer} />
            </div>
            {q.html.teaching ? (
              <details className="rounded-lg border border-border px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold">Teaching mode</summary>
                <ServerRichHtml html={q.html.teaching} className="mt-2" />
              </details>
            ) : (
              <p className="text-sm text-fg-3">No teaching-mode explanation.</p>
            )}
            {q.html.optionAnalysis?.length ? (
              <ul className="space-y-2">
                {q.html.optionAnalysis.map((o) => (
                  <li key={o.label} className="flex gap-3 rounded-lg border border-border px-3 py-2">
                    <span className={o.verdict === "correct" ? "w-24 shrink-0 font-semibold text-success" : "w-24 shrink-0 font-semibold text-danger"}>
                      ({o.label}) {o.verdict === "correct" ? "Correct" : "Wrong"}
                    </span>
                    <ServerRichHtml html={o.html} className="min-w-0 flex-1" />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Verification record" />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-fg-3">Answer verification</dt>
              <dd>
                {VERIFICATION_LABEL[av.status]} · {av.agreesWithKey ? "agrees with the key" : "DISAGREES with the key"}
              </dd>
              <dt className="text-fg-3">Method</dt>
              <dd>{av.method}</dd>
              {av.independentAnswer ? (
                <>
                  <dt className="text-fg-3">Independent answer</dt>
                  <dd>{av.independentAnswer}</dd>
                </>
              ) : null}
              {av.notes ? (
                <>
                  <dt className="text-fg-3">Notes</dt>
                  <dd className="whitespace-pre-line">{av.notes}</dd>
                </>
              ) : null}
              {q.transcription ? (
                <>
                  <dt className="text-fg-3">Transcription</dt>
                  <dd>
                    {VERIFICATION_LABEL[q.transcription.status]}
                    {q.transcription.notes ? ` · ${q.transcription.notes}` : ""}
                  </dd>
                </>
              ) : null}
              {q.solutionStatus ? (
                <>
                  <dt className="text-fg-3">Solution review</dt>
                  <dd>{VERIFICATION_LABEL[q.solutionStatus]}</dd>
                </>
              ) : null}
              <dt className="text-fg-3">Difficulty rationale</dt>
              <dd>{q.difficultyRationale}</dd>
              {q.dispute ? (
                <>
                  <dt className="text-fg-3">Dispute</dt>
                  <dd>
                    {q.dispute.status} · {q.dispute.decision} · resolved {q.dispute.resolvedAt}
                  </dd>
                </>
              ) : null}
              {av.checkCode ? (
                <>
                  <dt className="text-fg-3">Check code</dt>
                  <dd className="min-w-0">
                    <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs">{av.checkCode}</pre>
                  </dd>
                </>
              ) : null}
            </dl>
          </CardBody>
        </Card>
        <p className="text-sm">
          <Link href="/admin#questions" className="font-medium text-accent-text hover:underline">
            Back to the question table
          </Link>
        </p>
      </div>
    </>
  );
}
