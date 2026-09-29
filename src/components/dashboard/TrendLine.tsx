"use client";
/**
 * Responsive single-series line chart for trends on a fixed 0–yMax scale
 * (mock score %, accuracy %).
 *
 * The shared LineChart draws its text inside a fixed 640-unit viewBox, so on
 * a phone its axis labels shrink to about 5px. Here only the line is an SVG
 * stretched to the plot box (with non-scaling strokes); markers, axis labels
 * and the tooltip are HTML at their real size. Follows the chart-kit rules:
 * 2px line, ≥ 8px markers ringed in the surface colour, hairline gridlines,
 * text in text tokens, hover/focus tooltip, and the surrounding ChartFrame
 * provides the table view.
 */
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  key: string;
  /** X-axis label (short). */
  label: string;
  value: number | null;
  /** Extra tooltip line. */
  detail?: string;
}

const MAX_X_LABELS = 5;

/** Indices of the x labels to print: evenly spaced, always the first and last, never crowding the last. */
export function labelIndices(n: number, max = MAX_X_LABELS): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const every = Math.ceil(n / max);
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += every) if (i === 0 || n - 1 - i >= every * 0.75) out.push(i);
  out.push(n - 1);
  return out;
}

export function TrendLine({
  points,
  yMax = 100,
  formatValue,
  ariaLabel,
  color = "var(--accent)",
  height = 176,
}: {
  points: TrendPoint[];
  yMax?: number;
  formatValue: (v: number) => string;
  ariaLabel: string;
  color?: string;
  height?: number;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const hintId = useId();
  const n = points.length;
  if (!n) return null;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => (1 - Math.max(0, Math.min(yMax, v)) / yMax) * 100;
  let d = "";
  points.forEach((p, i) => {
    if (p.value === null) return;
    d += `${d && points[i - 1]?.value !== null ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`;
  });
  const ticks = [yMax, yMax / 2, 0];
  const shown = new Set(labelIndices(n));
  const active = idx !== null ? points[idx] : null;
  const move = (delta: number) => setIdx((i) => Math.max(0, Math.min(n - 1, (i ?? (delta > 0 ? -1 : n)) + delta)));

  return (
    <div className="select-none">
      <div className="flex">
        {/* y-axis labels */}
        <div aria-hidden className="tnum relative w-10 shrink-0 text-[11px] text-fg-3" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 leading-none" style={{ top: `${y(t)}%` }}>
              {formatValue(t)}
            </span>
          ))}
        </div>
        {/* plot */}
        <div
          role="group"
          aria-roledescription="line chart"
          aria-label={ariaLabel}
          aria-describedby={hintId}
          tabIndex={0}
          className="relative mx-1.5 min-w-0 flex-1 rounded-sm"
          style={{ height }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const ratio = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
            setIdx(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
          }}
          onMouseLeave={() => setIdx(null)}
          onFocus={() => setIdx((i) => i ?? n - 1)}
          onBlur={() => setIdx(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") move(1);
            else if (e.key === "ArrowLeft" || e.key === "ArrowDown") move(-1);
            else if (e.key === "Home") setIdx(0);
            else if (e.key === "End") setIdx(n - 1);
            else if (e.key === "Escape") setIdx(null);
            else return;
            e.preventDefault();
          }}
        >
          <span id={hintId} className="sr-only">
            Use the left and right arrow keys to read each point, or open the table view.
          </span>
          {ticks.map((t) => (
            <span key={t} aria-hidden className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-[var(--border-strong)]" : "bg-[var(--grid)]")} style={{ top: `${y(t)}%` }} />
          ))}
          <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {idx !== null ? <line x1={x(idx)} x2={x(idx)} y1={0} y2={100} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p, i) =>
            p.value !== null && (n <= 24 || i === n - 1 || i === idx) ? (
              <span
                key={p.key}
                aria-hidden
                className="absolute h-2.5 w-2.5 rounded-full"
                style={{ left: `${x(i)}%`, top: `${y(p.value)}%`, background: color, boxShadow: "0 0 0 2px var(--surface)", transform: `translate(-50%, -50%) scale(${i === idx ? 1.25 : 1})` }}
              />
            ) : null,
          )}
          {active && idx !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute z-10 min-w-24 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
              style={{
                left: `${x(idx)}%`,
                top: `calc(${active.value === null ? 50 : y(active.value)}% - 10px)`,
                transform: `translate(${x(idx) < 20 ? "-12px" : x(idx) > 80 ? "calc(-100% + 12px)" : "-50%"}, -100%)`,
              }}
            >
              <div className="text-fg-3">{active.label}</div>
              <div className="tnum text-sm font-semibold text-fg">{active.value === null ? "No data" : formatValue(active.value)}</div>
              {active.detail ? <div className="text-fg-3">{active.detail}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
      {/* x-axis labels */}
      <div aria-hidden className="relative ml-10 mr-1.5 mt-1.5 h-4 text-[11px] text-fg-3">
        <div className="absolute inset-y-0 left-1.5 right-0">
          {points.map((p, i) =>
            shown.has(i) ? (
              <span
                key={p.key}
                className="absolute top-0 whitespace-nowrap leading-4"
                style={{ left: `${x(i)}%`, transform: n === 1 ? "translateX(-50%)" : i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {p.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
