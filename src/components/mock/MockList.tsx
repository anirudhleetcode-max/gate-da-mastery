"use client";
import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2, Clock3, Lock, PlayCircle } from "lucide-react";
import type { MockTier } from "@/lib/content/schema";
import type { MockAttemptRow } from "@/lib/userdata/db";
import { useMockAttempts, useUserData } from "@/lib/userdata/hooks";
import type { MockSummary } from "@/lib/mock/types";
import { formatMinutes, formatDateTime } from "@/lib/mock/format";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { SUBJECT_ABBR, SUBJECT_SHORT } from "@/lib/labels";
import { formatClock, formatMarks, pct, cn } from "@/lib/utils";

export interface TierGroup {
  tier: MockTier;
  label: string;
  range: string;
  explanation: string;
  mocks: MockSummary[];
}

export interface MockUserSummary {
  inProgress?: MockAttemptRow;
  submitted: MockAttemptRow[];
  best?: MockAttemptRow;
  last?: MockAttemptRow;
}

/** Per-mock summary of the student's attempts (newest first in `submitted`). */
export function summariseAttempts(rows: readonly MockAttemptRow[]): Map<string, MockUserSummary> {
  const m = new Map<string, MockUserSummary>();
  const sorted = [...rows].sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt));
  for (const r of sorted) {
    const s = m.get(r.testId) ?? { submitted: [] };
    if (r.status === "in_progress") {
      if (!s.inProgress || s.inProgress.startedAt < r.startedAt) s.inProgress = r;
    } else {
      s.submitted.push(r);
      if (!s.last) s.last = r;
      if (r.result && (!s.best?.result || r.result.score > s.best.result.score)) s.best = r;
    }
    m.set(r.testId, s);
  }
  return m;
}

export function MockList({ tiers }: { tiers: TierGroup[] }) {
  const rows = useMockAttempts();
  const { ready } = useUserData();
  const byTest = useMemo(() => summariseAttempts(rows), [rows]);
  const all = tiers.flatMap((t) => t.mocks);
  const inProgress = all.filter((m) => byTest.get(m.id)?.inProgress);
  const taken = all.filter((m) => (byTest.get(m.id)?.submitted.length ?? 0) > 0).length;
  const available = all.filter((m) => m.available).length;
  const nextUp = all.find((m) => m.available && !byTest.get(m.id)?.submitted.length && !byTest.get(m.id)?.inProgress);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ your progress */}
      <section aria-labelledby="mock-progress" className="space-y-3">
        <h2 id="mock-progress" className="sr-only">
          Your mock progress
        </h2>
        {inProgress.map((m) => {
          const a = byTest.get(m.id)!.inProgress!;
          return (
            <Callout key={m.id} tone="warning" title={`Mock ${m.number} is in progress`}>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>
                  {formatClock(a.remainingMs)} remaining. The timer is paused until you resume.
                </span>
                <Link href={`/mocks/${m.id}/exam`} className="font-medium text-accent-text underline">
                  Resume Mock {m.number}
                </Link>
              </span>
            </Callout>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-fg-2">
            <span className="tnum font-semibold text-fg">{available}</span> of {all.length} mocks available now
          </p>
          <p className="text-fg-2">
            {ready ? (
              taken ? (
                <>
                  You have taken <span className="tnum font-semibold text-fg">{taken}</span> {taken === 1 ? "mock" : "mocks"}
                </>
              ) : (
                "You have not taken a mock yet"
              )
            ) : (
              "Loading your attempts…"
            )}
          </p>
          {nextUp ? (
            <p className="text-fg-2 sm:ml-auto">
              Next in sequence:{" "}
              <Link href={`/mocks/${nextUp.id}`} className="font-medium text-accent-text hover:underline">
                Mock {nextUp.number}: {nextUp.shortTitle}
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------ tiers */}
      {tiers.map((t) => {
        const avail = t.mocks.filter((m) => m.available).length;
        return (
          <section key={t.tier} id={`tier-${t.tier.toLowerCase()}`} aria-labelledby={`tier-h-${t.tier}`} className="scroll-mt-20">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <h2 id={`tier-h-${t.tier}`} className="text-lg font-semibold text-fg">
                  {t.label} <span className="text-sm font-normal text-fg-3">· {t.range}</span>
                </h2>
                <p className="mt-0.5 max-w-3xl text-sm text-fg-2">{t.explanation}</p>
              </div>
              <p className="tnum text-sm text-fg-3">
                {avail} of {t.mocks.length} available
              </p>
            </div>
            {avail ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {t.mocks
                  .filter((m) => m.available)
                  .map((m) => (
                    <li key={m.id} className="min-w-0">
                      <MockCard m={m} user={byTest.get(m.id)} />
                    </li>
                  ))}
              </ul>
            ) : null}
            {avail < t.mocks.length ? (
              <div className={avail ? "mt-4" : undefined}>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg-3">
                  <Lock aria-hidden className="h-3 w-3" /> Not yet available ({t.mocks.length - avail})
                </h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {t.mocks
                    .filter((m) => !m.available)
                    .map((m) => (
                      <li key={m.id} className="min-w-0">
                        <PendingTile m={m} />
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** Compact, non-interactive tile for a mock whose paper is not complete yet. */
function PendingTile({ m }: { m: MockSummary }) {
  const focus = m.shortTitle.split(" — ")[1];
  return (
    <div className="h-full rounded-lg border border-dashed border-border-strong bg-surface-2/60 px-3 py-2 text-fg-3" title={`${m.title}: not yet available`}>
      <p className="text-sm font-medium text-fg-2">
        Mock {m.number}
        <span className="sr-only">: {m.shortTitle}, not yet available</span>
      </p>
      {focus ? (
        <p aria-hidden className="truncate text-xs">
          {focus}
        </p>
      ) : null}
      <p aria-hidden className="tnum text-xs">
        {m.questionCount} Q · {formatMinutes(m.durationMinutes)}
      </p>
    </div>
  );
}

/** "Mixed: P&S, LA, ML" for mixed-subject mocks; nothing when the title already names the subject. */
function coverage(m: MockSummary): string | null {
  if (m.shortTitle.includes(" — ") || m.subjects.length === 0) return null;
  if (m.subjects.length <= 2) return `Covers ${m.subjects.map((s) => SUBJECT_SHORT[s]).join(" and ")}`;
  return `Mixed: ${m.subjects.map((s) => SUBJECT_ABBR[s]).join(", ")}`;
}

function MockCard({ m, user }: { m: MockSummary; user?: MockUserSummary }) {
  const titleId = `mock-card-${m.id}`;
  const inProgress = user?.inProgress;
  const taken = user?.submitted.length ?? 0;
  const best = user?.best?.result;
  const last = user?.last;
  const covers = coverage(m);
  return (
    <article aria-labelledby={titleId} className={cn("flex h-full flex-col rounded-[var(--radius)] border bg-surface px-4 py-3 shadow-[var(--shadow)]", inProgress ? "border-warning/50" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-3">Mock {m.number}</p>
          <h3 id={titleId} className="font-semibold leading-snug text-fg">
            <Link href={`/mocks/${m.id}`} className="hover:underline">
              {m.shortTitle}
            </Link>
          </h3>
          {covers ? (
            <p className="mt-0.5 text-xs text-fg-3" title={m.subjects.map((s) => SUBJECT_SHORT[s]).join(", ")}>
              {covers}
            </p>
          ) : null}
        </div>
        {inProgress ? (
          <Badge tone="warning" className="shrink-0">
            <Clock3 aria-hidden className="h-3 w-3" /> In progress
          </Badge>
        ) : taken ? (
          <Badge tone="success" className="shrink-0">
            <CheckCircle2 aria-hidden className="h-3 w-3" /> Taken{taken > 1 ? ` ×${taken}` : ""}
          </Badge>
        ) : null}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-fg-3">Questions</dt>
          <dd className="tnum font-medium text-fg">{m.questionCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Marks</dt>
          <dd className="tnum font-medium text-fg">{m.totalMarks ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Time</dt>
          <dd className="tnum font-medium text-fg">{formatMinutes(m.durationMinutes)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-fg-3">{m.negativeMarking ? "Negative marking: −1/3 or −2/3 for a wrong MCQ" : "No negative marking"}</p>

      <div className="mt-auto pt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
          <div className="min-w-0">
            {inProgress ? (
              <p className="text-fg-2">
                <span className="tnum font-medium text-fg">{formatClock(inProgress.remainingMs)}</span> left
                <span className="block text-xs text-fg-3">Started {formatDateTime(inProgress.startedAt)}</span>
              </p>
            ) : last ? (
              <p className="text-fg-2">
                Best <span className="tnum font-medium text-fg">{best ? `${formatMarks(best.score)} / ${formatMarks(best.maxScore)}` : "—"}</span>
                {best?.accuracy !== undefined && best.accuracy !== null ? <span className="text-fg-3"> · {pct(best.accuracy, 0)} accuracy</span> : null}
                <span className="block text-xs text-fg-3">
                  Last {formatDateTime(last.submittedAt ?? last.startedAt)}
                  {last.result ? ` · ${formatMarks(last.result.score)} / ${formatMarks(last.result.maxScore)}` : " · scoring pending"}
                </span>
              </p>
            ) : (
              <p className="text-fg-3">Not attempted yet</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {last && !inProgress ? (
              <ButtonLink href={`/mocks/${m.id}/results/${last.id}`} variant="ghost" size="sm" className="h-10" aria-label={`Latest results of Mock ${m.number}`}>
                Results
              </ButtonLink>
            ) : null}
            {inProgress ? (
              <ButtonLink href={`/mocks/${m.id}/exam`} variant="primary" size="sm" className="h-10 text-surface" aria-label={`Resume Mock ${m.number}`}>
                <PlayCircle aria-hidden className="h-4 w-4" /> Resume
              </ButtonLink>
            ) : (
              <ButtonLink href={`/mocks/${m.id}`} variant={taken ? "secondary" : "primary"} size="sm" className={cn("h-10", !taken && "text-surface")} aria-label={`${taken ? "Retake" : "Start"} Mock ${m.number}`}>
                {taken ? "Retake" : "Start"}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
