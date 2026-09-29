import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mandatory integrity label shown on every mock page (violet, like the MOCK TEST origin badge). */
export function MockLabel({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-start gap-1.5 rounded-md border border-violet/30 bg-violet-soft px-2.5 py-1 text-xs text-fg",
        compact && "px-2 py-0.5 text-[0.7rem]",
        className,
      )}
    >
      <PenLine aria-hidden className={cn("mt-px h-3.5 w-3.5 shrink-0 text-violet", compact && "h-3 w-3")} />
      <span>
        <strong className="font-semibold tracking-wide text-violet">MOCK TEST</strong>
        {compact ? (
          <span> · original questions, not official GATE questions</span>
        ) : (
          <span> — original questions written for this platform (not official GATE questions)</span>
        )}
      </span>
    </p>
  );
}
