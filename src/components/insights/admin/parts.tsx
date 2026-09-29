/** Small server-compatible building blocks for the admin pages. */
import type { ReactNode } from "react";
import { BadgeCheck, CircleAlert, CircleDashed, FilePen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ReviewStatus } from "./data";

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Draft",
  SELF_CHECKED: "Self-checked",
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Needs review",
};

export const REVIEW_HELP: Record<ReviewStatus, string> = {
  DRAFT: "Written, but without an author computational check yet",
  SELF_CHECKED: "Author draft with a Python / derivation check; waiting for the blind independent re-solve",
  VERIFIED: "Passed the blind independent re-solve and every deterministic gate",
  NEEDS_REVIEW: "The verifier or a deterministic gate flagged a problem",
};

/** Review-pipeline status of an original question (text + icon + colour). */
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const Icon = status === "VERIFIED" ? BadgeCheck : status === "NEEDS_REVIEW" ? CircleAlert : status === "SELF_CHECKED" ? CircleDashed : FilePen;
  const tone = status === "VERIFIED" ? "success" : status === "NEEDS_REVIEW" ? "danger" : status === "SELF_CHECKED" ? "info" : "neutral";
  return (
    <Badge tone={tone} title={REVIEW_HELP[status]}>
      <Icon aria-hidden className="h-3 w-3" />
      {REVIEW_LABEL[status]}
    </Badge>
  );
}

/** Table wrapper: scrolls horizontally inside itself, never the page. */
export function TableWrap({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)} role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      {children}
    </div>
  );
}

export const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-fg-3";
export const td = "px-3 py-2 align-top";
export const tdNum = "tnum px-3 py-2 text-right align-top";

/** A numeric cell that shows "0" quietly. */
export function Num({ n }: { n: number }) {
  return <span className={n === 0 ? "text-fg-3" : "text-fg"}>{n}</span>;
}

export function Section({ id, title, description, children, action }: { id: string; title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="scroll-mt-20 space-y-3" id={id}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          {description ? <div className="mt-0.5 max-w-3xl text-sm text-fg-3">{description}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
