import { Circle, CircleCheck, CircleDashed, CircleMinus, CircleX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATE_LABEL, type PyqState } from "./status";

const ICON: Record<PyqState, { Icon: LucideIcon; className: string }> = {
  unattempted: { Icon: Circle, className: "text-border-strong" },
  correct: { Icon: CircleCheck, className: "text-success" },
  incorrect: { Icon: CircleX, className: "text-danger" },
  not_scored: { Icon: CircleMinus, className: "text-warning" },
  skipped: { Icon: CircleDashed, className: "text-fg-3" },
};

/** Shape + colour (never colour alone) + screen-reader text for the student's status on a question. */
export function StatusIcon({ state, className }: { state: PyqState; className?: string }) {
  const { Icon, className: tone } = ICON[state];
  return (
    <span className={cn("inline-flex shrink-0", className)} title={STATE_LABEL[state]}>
      <Icon aria-hidden className={cn("h-5 w-5", tone)} strokeWidth={2} />
      <span className="sr-only">{STATE_LABEL[state]}.</span>
    </span>
  );
}
