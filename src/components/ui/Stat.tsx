import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius)] border border-border bg-surface px-4 py-3", className)}>
      <div className="line-clamp-2 text-xs font-medium uppercase tracking-wide text-fg-3">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold text-fg">{value}</div>
      {hint ? <div className="mt-0.5 line-clamp-2 text-xs text-fg-3">{hint}</div> : null}
    </div>
  );
}
