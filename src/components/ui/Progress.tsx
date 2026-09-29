import { cn } from "@/lib/utils";

export function ProgressBar({ value, max = 1, label, className, tone = "accent", showValue = false }: { value: number; max?: number; label: string; className?: string; tone?: "accent" | "success" | "danger" | "warning"; showValue?: boolean }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = { accent: "bg-accent", success: "bg-success", danger: "bg-danger", warning: "bg-warning" }[tone];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${ratio * 100}%` }} />
      </div>
      {showValue ? <span className="tnum w-11 text-right text-xs text-fg-3">{Math.round(ratio * 100)}%</span> : null}
    </div>
  );
}
