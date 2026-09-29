/**
 * Horizontal bars, one per category, with every value printed (nothing is
 * hover-only).
 *
 * Phones: label and value share a row and the bar runs the full width below,
 * so it keeps a readable length (the shared BarList gives the label a fixed
 * 11rem column, which leaves about 50px of bar on a 390px screen).
 * From `sm` up: label | bar | value columns aligned across rows (CSS subgrid),
 * so every bar uses the same scale. Chart-kit rules: bars ≤ 24px thick with a
 * 4px rounded data end, text in text tokens, table view from ChartFrame.
 */
import { cn } from "@/lib/utils";

export interface MetricBar {
  key: string;
  label: string;
  value: number;
  /** Main value text (e.g. "68%", "21/30"). */
  display: string;
  /** Secondary text after the value (e.g. "of 22"). */
  detail?: string;
  color?: string;
}

export function MetricBars({ data, max, ariaLabel, className }: { data: MetricBar[]; max?: number; ariaLabel: string; className?: string }) {
  const m = max ?? Math.max(1e-9, ...data.map((d) => d.value));
  return (
    <ul aria-label={ariaLabel} className={cn("space-y-3 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:gap-x-3 sm:gap-y-2.5 sm:space-y-0", className)}>
      {data.map((d) => {
        const w = Math.max(0, Math.min(1, d.value / m));
        return (
          <li key={d.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:col-span-3 sm:grid-cols-subgrid">
            <span className="truncate text-fg-2" title={d.label}>
              {d.label}
            </span>
            <span className="tnum whitespace-nowrap text-right sm:col-start-3 sm:row-start-1">
              <span className="font-medium text-fg">{d.display}</span>
              {d.detail ? <span className="text-xs text-fg-3"> {d.detail}</span> : null}
            </span>
            <span aria-hidden className="relative col-span-2 block h-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-4">
              {w > 0 ? <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${w * 100}%`, minWidth: 2, background: d.color ?? "var(--accent)" }} /> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
