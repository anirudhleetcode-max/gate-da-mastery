/**
 * Official-source presentation for PYQ papers (server-compatible: no hooks).
 */
import { ChevronRight, ExternalLink, FileCheck2, FileText } from "lucide-react";
import type { Source, VerificationStatus } from "@/lib/content/schema";
import { VerificationBadge } from "@/components/question/badges";
import { VERIFICATION_LABEL } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

const KIND_LABEL: Partial<Record<Source["type"], string>> = {
  OFFICIAL_QUESTION_PAPER: "Question paper",
  OFFICIAL_ANSWER_KEY: "Answer key",
};

const isStatus = (s: string): s is VerificationStatus => s in VERIFICATION_LABEL;

function host(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.length > 1 ? u.pathname : ""}`;
  } catch {
    return url;
  }
}

/** Compact "Official source · Question paper ↗ [status]" link used on the paper timeline. */
export function OfficialSourceLink({ source, className }: { source: Source; className?: string }) {
  const kind = KIND_LABEL[source.type] ?? source.name;
  const Icon = source.type === "OFFICIAL_ANSWER_KEY" ? FileCheck2 : FileText;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
          title={source.name}
        >
          <Icon aria-hidden className="h-4 w-4 shrink-0" />
          <span>
            Official source · {kind}
            <span className="sr-only"> ({source.name}, opens in a new tab)</span>
          </span>
          <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-fg-2">
          <Icon aria-hidden className="h-4 w-4" /> Official source · {kind} (no public URL recorded)
        </span>
      )}
      {isStatus(source.verificationStatus) ? <VerificationBadge status={source.verificationStatus} /> : null}
    </span>
  );
}

/** Full provenance block: official URL, the mirror actually hashed, SHA-256, date and notes. */
export function SourceDetail({ source, heading }: { source: Source; heading: string }) {
  const Icon = source.type === "OFFICIAL_ANSWER_KEY" ? FileCheck2 : FileText;
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
            {heading}
          </h3>
          <p className="mt-0.5 text-sm text-fg-2">{source.name}</p>
          <p className="text-xs text-fg-3">
            {source.publisher} · checked {formatDate(source.verificationDate)}
          </p>
        </div>
        {isStatus(source.verificationStatus) ? <VerificationBadge status={source.verificationStatus} /> : null}
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-fg-3">Official source</dt>
          <dd className="min-w-0">
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-accent-text hover:underline">
                {host(source.url)}
                <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="text-fg-3">No public URL recorded</span>
            )}
          </dd>
        </div>
        {source.retrievedFrom ? (
          <div>
            <dt className="text-xs font-medium text-fg-3">File inspected (public mirror)</dt>
            <dd className="min-w-0">
              <a href={source.retrievedFrom} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-fg-2 underline decoration-border-strong underline-offset-2 hover:text-fg">
                {host(source.retrievedFrom)}
                <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </dd>
          </div>
        ) : null}
        {source.sha256 ? (
          <div>
            <dt className="text-xs font-medium text-fg-3">SHA-256 of the inspected file</dt>
            <dd>
              <code className="block break-all rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[0.72rem] leading-5 text-fg-2">{source.sha256}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      <details className="group rounded-md border border-border bg-surface-2/60 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-fg-2 marker:text-fg-3">How this source was verified</summary>
        <p className="mt-2 text-fg-2">{source.verificationNotes}</p>
      </details>
    </div>
  );
}

/** Verification of a paper's date / session / slot, with the notes and sources behind it. */
export function ScheduleVerification({ status, notes, sources, defaultOpen = false }: { status: string; notes: string; sources: Source[]; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-md border border-border bg-surface-2/60 px-3 py-2 text-sm" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-fg-3 transition-transform group-open:rotate-90" />
        <span className="font-medium text-fg-2">Date, session &amp; slot</span>
        {isStatus(status) ? <VerificationBadge status={status} /> : <span className="text-fg-3">{status}</span>}
        <span className="text-xs text-fg-3 group-open:hidden">Show verification notes</span>
      </summary>
      <p className="mt-2 text-fg-2">{notes}</p>
      {sources.length ? (
        <ul className="mt-3 space-y-2 border-t border-border pt-2">
          {sources.map((s) => (
            <li key={s.id} className="text-xs">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text hover:underline">
                  {s.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="font-medium text-fg-2">{s.name}</span>
              )}
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-fg-3">{s.type === "SECONDARY" ? "Secondary source" : "Official source"}</span>
                {isStatus(s.verificationStatus) ? <VerificationBadge status={s.verificationStatus} /> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
