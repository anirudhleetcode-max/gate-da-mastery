import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMock, getMockQuestions, getPattern, getSubject } from "@/lib/server/repo";
import { SUBJECT_COLOR, SUBJECT_SHORT, TIER_LABEL, TIER_RANGE, TYPE_HELP } from "@/lib/labels";
import { FULL_GATE_SECTIONS, TIER_EXPLANATION, displayTotalMarks, markingRules, sectionStructure, subjectDistribution, typeCounts } from "@/lib/mock/structure";
import { PALETTE_HELP, PALETTE_LABEL, PALETTE_ORDER } from "@/lib/mock/palette";
import { formatMinutes } from "@/lib/mock/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Callout } from "@/components/ui/Callout";
import { VerificationBadge } from "@/components/question/badges";
import { MockLabel } from "@/components/mock/MockLabel";
import { PaletteGlyph } from "@/components/mock/PaletteGlyph";
import { AttemptHistory, MockStartPanel } from "@/components/mock/MockIntroClient";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const test = getMock(id);
  if (!test) return { title: "Mock test not found" };
  return { title: test.title, description: test.description };
}

export default async function MockIntroPage({ params }: Params) {
  const { id } = await params;
  const test = getMock(id);
  if (!test) notFound();
  const questions = getMockQuestions(id);
  const pattern = getPattern();
  const total = displayTotalMarks(test);
  const loaded = questions.length;
  const planned = test.questionIds.length;
  const sections = test.available ? sectionStructure(questions) : test.tier === "FULL_GATE" ? FULL_GATE_SECTIONS : [];
  const types = typeCounts(questions);
  const subjects = subjectDistribution(questions);
  const maxSubjectMarks = Math.max(1, ...subjects.map((s) => s.marks));
  const rules = markingRules(pattern, test.negativeMarking);
  const multiSection = sections.length > 1;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Mock tests", href: "/mocks" }, { label: `Mock ${test.number}` }]}
        title={test.title}
        description={test.description}
      />
      <MockLabel className="mb-6" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------------------------ start (first on mobile, right column on desktop) */}
        <aside aria-label="Start this mock" className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start">
          <MockStartPanel testId={test.id} number={test.number} available={test.available} durationMinutes={test.durationMinutes} loaded={loaded} planned={planned} />
          <p className="px-1 text-xs leading-relaxed text-fg-3">
            {TIER_LABEL[test.tier]} ({TIER_RANGE[test.tier]}): {TIER_EXPLANATION[test.tier]}
          </p>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Questions" value={planned} />
            <Stat label="Total marks" value={total ?? "—"} hint={total === null ? "Known when the paper is complete" : undefined} />
            <Stat label="Duration" value={formatMinutes(test.durationMinutes)} />
            <Stat label="Negative marking" value={test.negativeMarking ? "MCQ only" : "None"} />
          </div>

          <AttemptHistory testId={test.id} />

          {/* ------------------------------------------------ structure */}
          <Card>
            <CardHeader title="Paper structure" description={test.available ? undefined : `${loaded} of ${planned} questions are published so far; the full breakdown appears when the paper is complete.`} />
            <CardBody className="space-y-6">
              {sections.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="mb-2 text-left text-sm font-medium text-fg">{multiSection ? "Sections" : "Questions and marks"}</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-fg-3">
                        <th scope="col" className="py-1.5 pr-3 font-medium">
                          Section
                        </th>
                        <th scope="col" className="px-2 py-1.5 font-medium">
                          Questions
                        </th>
                        <th scope="col" className="px-2 py-1.5 text-right font-medium">
                          1-mark
                        </th>
                        <th scope="col" className="px-2 py-1.5 text-right font-medium">
                          2-mark
                        </th>
                        <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                          Marks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((s) => (
                        <tr key={s.section} className="border-b border-border last:border-0">
                          <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">
                            {s.label} ({s.section})
                          </th>
                          <td className="tnum whitespace-nowrap px-2 py-2 text-fg-2">
                            Q{s.firstQ}–{s.lastQ} ({s.count})
                          </td>
                          <td className="tnum px-2 py-2 text-right text-fg-2">{s.oneMark}</td>
                          <td className="tnum px-2 py-2 text-right text-fg-2">{s.twoMark}</td>
                          <td className="tnum py-2 pl-2 text-right font-semibold text-fg">{s.marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!test.available && test.tier === "FULL_GATE" ? <p className="mt-2 text-xs text-fg-3">Planned structure, identical to the official DA paper pattern.</p> : null}
                </div>
              ) : null}

              {test.available ? (
                <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-fg">Question types</h3>
                    <ul className="space-y-2 text-sm">
                      {(["MCQ", "MSQ", "NAT"] as const).map((t) => (
                        <li key={t} className="flex items-baseline justify-between gap-3" title={TYPE_HELP[t]}>
                          <span className="text-fg-2">
                            <abbr title={TYPE_HELP[t]} className="font-medium text-fg no-underline">
                              {t}
                            </abbr>{" "}
                            {t === "MCQ" ? "single correct" : t === "MSQ" ? "multiple correct" : "numerical"}
                          </span>
                          <span className="tnum font-semibold text-fg">{types[t]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-2 text-sm font-medium text-fg">Subject distribution</h3>
                    <table className="w-full text-sm">
                      <caption className="sr-only">Questions and marks per subject</caption>
                      <thead>
                        <tr className="text-left text-xs text-fg-3">
                          <th scope="col" className="pb-1 pr-2 font-medium">
                            Subject
                          </th>
                          <th scope="col" className="px-2 pb-1 text-right font-medium">
                            Questions
                          </th>
                          <th scope="col" className="pb-1 pl-2 text-right font-medium">
                            Marks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((s) => (
                          <tr key={s.subjectId}>
                            <th scope="row" className="py-1 pr-2 text-left font-normal">
                              <span className="flex min-w-0 items-center gap-2">
                                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: SUBJECT_COLOR[s.subjectId] }} />
                                <span className="truncate text-fg-2" title={getSubject(s.subjectId)?.name}>
                                  {SUBJECT_SHORT[s.subjectId]}
                                </span>
                              </span>
                              <span aria-hidden className="mt-1 block h-1.5 rounded-r-full" style={{ width: `${(s.marks / maxSubjectMarks) * 100}%`, background: SUBJECT_COLOR[s.subjectId], opacity: 0.85 }} />
                            </th>
                            <td className="tnum px-2 py-1 text-right align-top text-fg-2">{s.count}</td>
                            <td className="tnum py-1 pl-2 text-right align-top font-medium text-fg">{s.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ marking */}
          <Card>
            <CardHeader
              title="Marking scheme"
              description="Scored exactly as in GATE."
              action={pattern ? <VerificationBadge status={pattern.marking.status} /> : undefined}
            />
            <CardBody>
              <dl className="divide-y divide-border text-sm">
                {rules.map((r) => (
                  <div key={r.label} className="grid gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="font-medium text-fg">{r.label}</dt>
                    <dd className="text-fg-2">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {pattern ? (
                <p className="mt-3 text-xs text-fg-3">
                  From the official GATE marking scheme recorded on the{" "}
                  <Link href="/sources" className="underline">
                    sources page
                  </Link>
                  . Mock scores are platform marks; they are not GATE scores and do not predict a rank.
                </p>
              ) : (
                <p className="mt-3 text-xs text-fg-3">Mock scores are platform marks; they are not GATE scores and do not predict a rank.</p>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------------------------ instructions */}
          <Card>
            <CardHeader title="Instructions" />
            <CardBody className="space-y-5 text-sm text-fg-2">
              <section aria-labelledby="ins-timer" className="space-y-1.5">
                <h3 id="ins-timer" className="font-medium text-fg">
                  Timer
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>The countdown (hh:mm:ss) starts at {formatMinutes(test.durationMinutes)} when the exam screen opens. It turns red at 10 minutes left, and screen readers hear alerts at 30, 10, 5 and 1 minute(s).</li>
                  <li>
                    <strong className="text-fg">At 0:00 the test is submitted automatically</strong> with the answers you have given.
                  </li>
                  <li>
                    The timer runs only while the exam page is open. If you close or refresh the page, your answers and remaining time are saved on this device and the timer pauses until you resume. The real exam never pauses, so take full
                    simulations in one sitting.
                  </li>
                </ul>
              </section>

              <section aria-labelledby="ins-palette" className="space-y-2">
                <h3 id="ins-palette" className="font-medium text-fg">
                  Question palette
                </h3>
                <p>Every question has a numbered button in the palette (a slide-in panel on phones). Its shape and badge show its status:</p>
                <ul className="space-y-2">
                  {PALETTE_ORDER.map((s, i) => (
                    <li key={s} className="flex items-start gap-3">
                      <PaletteGlyph state={s}>{i + 1}</PaletteGlyph>
                      <span className="pt-0.5">
                        <strong className="font-medium text-fg">{PALETTE_LABEL[s]}.</strong> {PALETTE_HELP[s]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="ins-actions" className="space-y-1.5">
                <h3 id="ins-actions" className="font-medium text-fg">
                  Buttons
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-fg">Save &amp; next</strong> keeps your answer, removes a review mark and opens the next question.
                  </li>
                  <li>
                    <strong className="text-fg">Mark for review &amp; next</strong> flags the question to revisit and opens the next one. An answered question that is marked for review is still scored.
                  </li>
                  <li>
                    <strong className="text-fg">Clear response</strong> removes your answer to the current question. <strong className="text-fg">Previous</strong> goes back one question.
                  </li>
                  {multiSection ? <li>The section tabs at the top jump to the first question of General Aptitude or Data Science &amp; AI; the palette shows the current section.</li> : null}
                  <li>
                    <strong className="text-fg">Submit</strong> shows a summary of answered, not answered, marked and not visited questions before you confirm. <strong className="text-fg">Exit</strong> saves and pauses the test.
                  </li>
                  <li>Keyboard: ← and → move to the previous or next question when the focus is not inside an answer field; in the palette, arrow keys move between numbers and Enter opens one.</li>
                </ul>
              </section>

              <section aria-labelledby="ins-answer" className="space-y-1.5">
                <h3 id="ins-answer" className="font-medium text-fg">
                  Answering
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>MCQ: choose one option. MSQ: choose every correct option. NAT: type a number.</li>
                  <li>
                    NAT answers: the real exam uses an on-screen virtual numeric keypad. Here it is replaced by a normal text field that accepts digits, a decimal point and a sign.
                  </li>
                  <li>
                    Your selection is saved the moment you make it. In the real GATE interface an answer is saved only when you click Save &amp; Next or Mark for Review &amp; Next, so make a habit of clicking them.
                  </li>
                  <li>You can optionally record your confidence (high, medium or low). Results then point out wrong answers given with high confidence.</li>
                  <li>GATE provides an on-screen scientific calculator; this platform does not, so keep rough work on paper.</li>
                </ul>
              </section>

              <Callout tone="info" title="After you submit">
                You get your score, subject and topic analysis, time analysis and full solutions. Every wrong answer is added to your revision queue, and to your error log if automatic error logging is on in{" "}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
                .
              </Callout>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
