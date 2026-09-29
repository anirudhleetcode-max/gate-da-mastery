"use client";
/**
 * Two thin bars per category ("then" vs "now") on one shared 0–100% scale.
 * Follows the chart-kit rules: ≤ 24px bars with a 4px rounded data end,
 * values printed in text tokens beside every bar (so nothing is hover-only),
 * and a table view provided by the surrounding ChartFrame.
 */
import { useState } from "react";

export interface PairedDatum {
  key: string;
  label: string;
  /** 0–1, or null when there is no data for that period. */
  a: number | null;
  b: number | null;
  /** Text shown beside each bar (defaults to the formatted value). */
  aText?: string;
  bText?: string;
  note?: string;
}

export function PairedBars({
  data,
  aLabel,
  bLabel,
  aColor,
  bColor,
  format,
  ariaLabel,
}: {
  data: PairedDatum[];
  aLabel: string;
  bLabel: string;
  aColor: string;
  bColor: string;
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {data.map((d) => (
        <li
          key={d.key}
          onMouseEnter={() => setHover(d.key)}
          onMouseLeave={() => setHover(null)}
          className="grid grid-cols-1 gap-1 rounded-md text-sm sm:grid-cols-[15rem_1fr] sm:items-center sm:gap-3"
          style={{ opacity: hover && hover !== d.key ? 0.6 : 1 }}
        >
          <span className="min-w-0">
            <span className="block truncate text-fg-2" title={d.label}>
              {d.label}
            </span>
            {d.note ? <span className="block text-xs text-fg-3">{d.note}</span> : null}
          </span>
          <span className="space-y-1">
            {([
              ["a", d.a, aColor, aLabel, d.aText],
              ["b", d.b, bColor, bLabel, d.bText],
            ] as const).map(([k, v, color, label, text]) => (
              <span key={k} className="flex items-center gap-2">
                <span className="relative block h-2.5 flex-1">
                  {v !== null ? (
                    <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, minWidth: 2, background: color }} />
                  ) : null}
                </span>
                <span className="tnum w-28 shrink-0 text-right text-xs text-fg-2">
                  <span className="sr-only">{label}: </span>
                  {text ?? (v === null ? "no data" : format(v))}
                </span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
