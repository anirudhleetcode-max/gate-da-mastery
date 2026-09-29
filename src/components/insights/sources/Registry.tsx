/** Source registry, exam papers and exam-pattern facts (server components). */
import { ExternalLink, FileCheck2, FileText, Globe, Library, ScrollText } from "lucide-react";
import type { ExamPaper, ExamPattern, Source, SourceType } from "@/lib/content/schema";
import { VerificationBadge } from "@/components/question/badges";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SLOT_LABEL } from "@/lib/labels";
import { formatDate, formatMarks, plural } from "@/lib/utils";
import { CopyButton } from "./CopyButton";
import { ExtLink, Fact, H3, shortUrl } from "./ui";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  OFFICIAL_QUESTION_PAPER: "Official question paper",
  OFFICIAL_ANSWER_KEY: "Official answer key",
  OFFICIAL_SYLLABUS: "Official syllabus",
  OFFICIAL_INFORMATION_BROCHURE: "Official information brochure",
  OFFICIAL_WEBSITE: "Official website",
  OFFICIAL_SAMPLE_PAPER: "Official sample paper",
  SECONDARY: "Secondary source",
  PLATFORM: "Platform",
};

const GROUPS: { id: string; title: string; types: SourceType[] }[] = [
  { id: "papers-keys", title: "Question papers and answer keys", types: ["OFFICIAL_QUESTION_PAPER", "OFFICIAL_ANSWER_KEY", "OFFICIAL_SAMPLE_PAPER"] },
  { id: "syllabus", title: "Syllabus", types: ["OFFICIAL_SYLLABUS"] },
  { id: "schedule", title: "Schedule, brochure and official websites", types: ["OFFICIAL_WEBSITE", "OFFICIAL_INFORMATION_BROCHURE"] },
  { id: "other", title: "Secondary and platform sources", types: ["SECONDARY", "PLATFORM"] },
];

const ICON: Partial<Record<SourceType, typeof FileText>> = {
  OFFICIAL_QUESTION_PAPER: FileText,
  OFFICIAL_ANSWER_KEY: FileCheck2,
  OFFICIAL_SAMPLE_PAPER: FileText,
  OFFICIAL_SYLLABUS: ScrollText,
  OFFICIAL_WEBSITE: Globe,
  OFFICIAL_INFORMATION_BROCHURE: Library,
};

const truncHash = (h: string) => `${h.slice(0, 12)}…${h.slice(-8)}`;

function SourceCard({ s }: { s: Source }) {
  const Icon = ICON[s.type] ?? FileText;
  const mirrorIsUrl = s.retrievedFrom ? /^https?:\/\//.test(s.retrievedFrom) : false;
  return (
    <Card id={`source-${s.id}`} className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2.5">
          <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />
          <div className="min-w-0">
            <h4 className="font-semibold leading-snug text-fg">{s.name}</h4>
            <p className="text-xs text-fg-3">
              {SOURCE_TYPE_LABEL[s.type]} · {s.publisher} · checked {formatDate(s.verificationDate)}
            </p>
          </div>
        </div>
        <VerificationBadge status={s.verificationStatus} />
      </div>
      <dl className="mt-3 grid gap-2.5">
        <Fact label="Official URL">
          {s.url ? (
            <ExtLink href={s.url}>
              {shortUrl(s.url)} <ExternalLink aria-hidden className="inline h-3 w-3" />
            </ExtLink>
          ) : (
            <span className="text-fg-3">None: this is not an externally published document.</span>
          )}
        </Fact>
        {s.retrievedFrom ? (
          <Fact label="Bytes retrieved from (mirror)">
            {mirrorIsUrl ? (
              <ExtLink href={s.retrievedFrom}>
                {shortUrl(s.retrievedFrom)} <ExternalLink aria-hidden className="inline h-3 w-3" />
              </ExtLink>
            ) : (
              s.retrievedFrom
            )}
          </Fact>
        ) : null}
        {s.sha256 ? (
          <Fact label="SHA-256 of the inspected file">
            <span className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg" title={s.sha256}>
                <span aria-hidden>{truncHash(s.sha256)}</span>
                <span className="sr-only">{s.sha256}</span>
              </code>
              <CopyButton value={s.sha256} label={`Copy the SHA-256 of ${s.name}`} />
            </span>
          </Fact>
        ) : null}
      </dl>
      <details className="mt-3 border-t border-border pt-2">
        <summary className="cursor-pointer text-sm font-medium text-accent-text">How this status was reached</summary>
        <p className="mt-1.5 text-sm text-fg-2">{s.verificationNotes}</p>
      </details>
    </Card>
  );
}

export function SourceRegistry({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return <EmptyState title="The source registry is empty">Add sources to content/sources.json and rebuild the content bundle.</EmptyState>;
  }
  const byStatus = (st: Source["verificationStatus"]) => sources.filter((s) => s.verificationStatus === st).length;
  return (
    <div className="space-y-6">
      <p className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
        <span>{plural(sources.length, "source")}:</span>
        <Badge tone="success">{byStatus("VERIFIED")} verified</Badge>
        <Badge tone="warning">{byStatus("PARTIALLY_VERIFIED")} partially verified</Badge>
        <Badge tone="danger">{byStatus("NEEDS_REVIEW")} need review</Badge>
      </p>
      {GROUPS.map((g) => {
        const list = sources.filter((s) => g.types.includes(s.type));
        if (!list.length) return null;
        return (
          <div key={g.id} className="space-y-3">
            <H3 id={`sources-${g.id}`}>
              {g.title} <span className="font-normal text-fg-3">({list.length})</span>
            </H3>
            <div className="grid gap-3 lg:grid-cols-2">
              {list.map((s) => (
                <SourceCard key={s.id} s={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PapersSection({ papers, sourceName, loaded }: { papers: ExamPaper[]; sourceName: (id: string) => string; loaded: Record<string, number> }) {
  if (!papers.length) return <EmptyState title="No exam papers recorded">Add papers to content/exam/papers.json.</EmptyState>;
  const sorted = [...papers].sort((a, b) => b.examDate.localeCompare(a.examDate));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((p) => (
        <Card key={p.id} className="flex min-w-0 flex-col p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <H3>GATE DA {p.year}</H3>
              <p className="text-xs text-fg-3">{p.id}</p>
            </div>
            <VerificationBadge status={p.scheduleStatus} />
          </div>
          <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-fg-3">Exam date</dt>
            <dd>{formatDate(p.examDate)}</dd>
            <dt className="text-fg-3">Session · slot</dt>
            <dd>
              Session {p.session} · {SLOT_LABEL[p.slot] ?? p.slot} <span className="block whitespace-nowrap text-fg-3">{p.slotTime}</span>
            </dd>
            <dt className="text-fg-3">Institute</dt>
            <dd>{p.organizingInstitute}</dd>
            <dt className="text-fg-3">Paper</dt>
            <dd>
              <span className="whitespace-nowrap">{p.totalQuestions} questions</span> · <span className="whitespace-nowrap">{formatMarks(p.totalMarks)} marks</span> ·{" "}
              <span className="whitespace-nowrap">{p.durationMinutes} min</span>
            </dd>
            <dt className="text-fg-3">On this platform</dt>
            <dd>
              {loaded[p.id] ?? 0} of {p.totalQuestions} questions
            </dd>
          </dl>
          <p className="mt-3 flex-1 text-xs text-fg-3">
            Sources:{" "}
            {[p.questionPaperSourceId, p.answerKeySourceId, ...p.scheduleSourceIds.filter((s) => s !== p.answerKeySourceId)].map((id, i) => (
              <span key={id}>
                {i ? ", " : ""}
                <a href={`#source-${id}`} className="text-accent-text hover:underline">
                  {sourceName(id)}
                </a>
              </span>
            ))}
          </p>
          <details className="mt-2 border-t border-border pt-2">
            <summary className="cursor-pointer text-sm font-medium text-accent-text">How the date and slot were checked</summary>
            <p className="mt-1.5 text-sm text-fg-2">{p.scheduleNotes}</p>
          </details>
        </Card>
      ))}
    </div>
  );
}

export function PatternSection({ pattern, sourceName }: { pattern: ExamPattern | null; sourceName: (id: string) => string }) {
  if (!pattern) return <EmptyState title="No exam-pattern facts recorded">Add verified facts to content/exam/pattern.json.</EmptyState>;
  const m = pattern.marking;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {pattern.facts.map((f) => (
          <li key={f.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[13rem_1fr_auto] sm:px-5">
            <p className="text-sm font-medium text-fg-2">{f.label}</p>
            <div className="min-w-0 text-sm">
              <p className="text-fg">{f.value}</p>
              {f.notes ? <p className="mt-0.5 text-xs text-fg-3">{f.notes}</p> : null}
              <p className="mt-0.5 text-xs text-fg-3">
                Source{f.sourceIds.length > 1 ? "s" : ""}:{" "}
                {f.sourceIds.map((id, i) => (
                  <span key={id}>
                    {i ? ", " : ""}
                    <a href={`#source-${id}`} className="text-accent-text hover:underline">
                      {sourceName(id)}
                    </a>
                  </span>
                ))}
              </p>
            </div>
            <div className="sm:text-right">
              <VerificationBadge status={f.status} />
            </div>
          </li>
        ))}
        <li className="grid gap-x-4 gap-y-1 bg-surface-2/60 px-4 py-3 sm:grid-cols-[13rem_1fr_auto] sm:px-5">
          <p className="text-sm font-medium text-fg-2">Marking scheme used for scoring</p>
          <p className="text-sm text-fg">
            MCQ wrong answer: −{formatMarks(m.mcqNegativeFraction * 3)}/3 of the question&apos;s marks · MSQ wrong: {m.msqNegative === 0 ? "no penalty" : `−${m.msqNegative}`} · NAT wrong:{" "}
            {m.natNegative === 0 ? "no penalty" : `−${m.natNegative}`} · MSQ partial credit: {m.msqPartialCredit ? "yes" : "none"}
          </p>
          <div className="sm:text-right">
            <VerificationBadge status={m.status} />
          </div>
        </li>
      </ul>
    </Card>
  );
}
