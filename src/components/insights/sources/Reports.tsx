/** Audit-report summaries and the copyright notice (server components). */
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Stat } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/Progress";
import type { ContentAuditSummary, MockVerificationSummary } from "./data";
import { formatStamp } from "./data";
import { H3, Mono } from "./ui";

/** How the report relates to the content build the site is serving (they are produced by different commands). */
function Staleness({ generatedAt, builtAt, command }: { generatedAt: string; builtAt: string; command: string }) {
  if (generatedAt < builtAt) {
    return (
      <p className="text-sm text-fg-3">
        This report is older than the content build being served ({formatStamp(builtAt)}), so some figures may be out of date. Run <Mono>{command}</Mono> to refresh it.
      </p>
    );
  }
  return (
    <p className="text-sm text-fg-3">
      This report reads the content files directly and is newer than the content build being served ({formatStamp(builtAt)}). Where the two differ, the site shows the build; changes reach students after
      the next <Mono>npm run content:build</Mono>.
    </p>
  );
}

export function ContentAuditReport({ audit, builtAt }: { audit: ContentAuditSummary; builtAt: string }) {
  const s = audit.sources;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H3>Content audit</H3>
        <p className="text-sm text-fg-3">
          Generated <time dateTime={audit.generatedAt}>{formatStamp(audit.generatedAt)}</time> by <Mono>npm run content:audit</Mono>
        </p>
      </div>
      <Staleness generatedAt={audit.generatedAt} builtAt={builtAt} command="npm run content:audit" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {audit.pyq ? <Stat label="Official PYQs fully verified" value={`${audit.pyq.verified}/${audit.pyq.total}`} hint="transcription, answer and solution" /> : null}
        {audit.mocks ? <Stat label="Mock tests complete" value={`${audit.mocks.complete}/${audit.mocks.tests}`} hint={`${audit.mocks.questions} of ${audit.mocks.expected} questions written`} /> : null}
        {audit.practice ? <Stat label="Practice questions" value={audit.practice.questions} hint={`${audit.practice.verified} verified`} /> : null}
        {audit.errors !== null ? <Stat label="Validation errors" value={audit.errors} hint={`${audit.warnings ?? 0} warnings`} /> : null}
      </div>
      <Card className="p-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-fg-3">Publication status:</dt>
            <dd>
              {audit.publishable === null ? (
                "not reported"
              ) : audit.publishable ? (
                <Badge tone="success">Publishable</Badge>
              ) : (
                <Badge tone="warning">Not yet publishable: content still in progress</Badge>
              )}
            </dd>
          </div>
          {audit.pyq ? (
            <div>
              <dt className="inline text-fg-3">Disagreements with the official key: </dt>
              <dd className="inline">{audit.pyq.disagree.length ? audit.pyq.disagree.join(", ") : "none"}</dd>
            </div>
          ) : null}
          {audit.pyq ? (
            <div>
              <dt className="inline text-fg-3">Marks-to-all questions: </dt>
              <dd className="inline">{audit.pyq.marksToAll.length ? audit.pyq.marksToAll.join(", ") : "none"}</dd>
            </div>
          ) : null}
          {audit.duplicates !== null ? (
            <div>
              <dt className="inline text-fg-3">Duplicate questions found: </dt>
              <dd className="inline">{audit.duplicates}</dd>
            </div>
          ) : null}
          {audit.learning ? (
            <div>
              <dt className="inline text-fg-3">Learning content: </dt>
              <dd className="inline">
                {audit.learning.concepts} concepts, {audit.learning.formulas} formulas, {audit.learning.strategy} strategy articles, {audit.learning.roadmap} roadmap stages
              </dd>
            </div>
          ) : null}
          {s ? (
            <div>
              <dt className="inline text-fg-3">Sources: </dt>
              <dd className="inline">
                {s.total} ({Object.entries(s.byStatus)
                  .map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, " ")}`)
                  .join(", ")}
                )
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>
    </div>
  );
}

export function MockVerificationReport({ report, builtAt }: { report: MockVerificationSummary; builtAt: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H3>Mock verification</H3>
        <p className="text-sm text-fg-3">
          Generated <time dateTime={report.generatedAt}>{formatStamp(report.generatedAt)}</time> by <Mono>npm run content:mock-review</Mono>
        </p>
      </div>
      <Staleness generatedAt={report.generatedAt} builtAt={builtAt} command="npm run content:mock-review" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Questions verified" value={`${report.verified}/${report.plannedQuestions}`} hint={`${report.drafted} written so far`} />
        <Stat label="Awaiting re-solve" value={report.selfChecked} hint="self-checked" />
        <Stat label="Needs review" value={report.needsReview} hint={`${report.draft} drafts`} />
        <Stat label="Fixed during verification" value={report.fixedDuringVerification} hint="then verified" />
      </div>
      {report.tests.length ? (
        <Card>
          <div role="region" aria-label="Mock verification by test" tabIndex={0} className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Mock verification by test (tests with written questions)</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-3">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Test
                  </th>
                  <th scope="col" className="min-w-40 px-4 py-2 font-medium">
                    Verified / planned
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Self-checked
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Needs review
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Fixed
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Complete
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.tests.map((t) => (
                  <tr key={t.test} className="border-b border-border last:border-0">
                    <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-medium">
                      {t.test.startsWith("mock-") ? `Mock ${Number(t.test.slice(5))}` : t.test}
                    </th>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={t.verified} max={t.planned} label={`${t.test}: ${t.verified} of ${t.planned} verified`} tone={t.complete ? "success" : "accent"} className="w-24" />
                        <span className="tnum whitespace-nowrap text-fg-2">
                          {t.verified}/{t.planned}
                        </span>
                      </div>
                    </td>
                    <td className="tnum px-4 py-2 text-right">{t.selfChecked}</td>
                    <td className="tnum px-4 py-2 text-right">{t.needsReview}</td>
                    <td className="tnum px-4 py-2 text-right">{t.fixed}</td>
                    <td className="px-4 py-2">{t.complete ? <Badge tone="success">Yes</Badge> : <Badge tone="outline">Not yet</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-fg-3">
            Lists tests with at least one written question. A complete test in this report opens to students after the next content build.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

export function Copyright() {
  return (
    <Callout tone="info" title="Copyright and affiliation">
      <p>
        Official GATE question papers and answer keys are the property of the respective organizing institutes (IISc Bengaluru for GATE 2024, IIT Roorkee for GATE 2025 and IIT Guwahati for GATE 2026).
        They are reproduced here for educational reference, with attribution and links to the official sources listed above.
      </p>
      <p className="mt-2">
        Solutions, explanations, teaching notes and all mock-test and practice questions are original content written for this platform.
      </p>
      <p className="mt-2 font-medium text-fg">This platform is not affiliated with, endorsed by or connected to GATE, IISc or any IIT.</p>
    </Callout>
  );
}
