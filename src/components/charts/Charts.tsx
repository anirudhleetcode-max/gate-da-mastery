"use client";
/**
 * Small SVG chart kit following the platform's data-viz rules:
 *  - bars ≤ 24px thick, 4px rounded data end, square at the baseline;
 *  - 2px lines with ≥ 8px end markers ringed in the surface colour;
 *  - hairline, recessive gridlines; one y-axis only;
 *  - text uses text tokens, never the series colour;
 *  - legends for ≥ 2 series; values at bar tips; hover/focus tooltips;
 *  - every chart has a table view (tooltips enhance, never gate).
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartFrameProps {
  title: string;
  description?: ReactNode;
  legend?: { label: string; color: string; kind?: "rect" | "line" }[];
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}

export function ChartFrame({ title, description, legend, table, children, className }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure className={cn("min-w-0 rounded-[var(--radius)] border border-border bg-surface p-4", className)} aria-labelledby={`${id}-t`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <figcaption id={`${id}-t`} className="font-semibold text-fg">
            {title}
          </figcaption>
          {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable} className="rounded-md border border-border px-2 py-1 text-xs font-medium text-fg-2 hover:bg-surface-2">
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {legend && legend.length >= 2 && !showTable ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              {l.kind === "line" ? (
                <span aria-hidden className="inline-block h-0.5 w-3.5 rounded" style={{ background: l.color }} />
              ) : (
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} />
              )}
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      {showTable ? <DataTable {...table} caption={title} /> : children}
    </figure>
  );
}

export function DataTable({ columns, rows, caption }: { columns: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-fg-3">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-2 py-1.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((v, j) => (
                <td key={j} className={cn("px-2 py-1.5", j > 0 && "tnum")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ tooltip

/** Positioned in percent of the chart box so it tracks marks when the SVG scales. */
function Tooltip({ x, y, children }: { x: string; y: string; children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-28 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: x, top: `calc(${y} - 8px)` }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ horizontal bars

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
  /** Text shown at the bar tip (defaults to value). */
  display?: string;
  /** Extra tooltip line. */
  detail?: string;
}

/** Horizontal bar list: one bar per category, value label at the tip. */
export function BarList({ data, max, formatValue = (v) => String(v), height = 22, ariaLabel }: { data: BarDatum[]; max?: number; formatValue?: (v: number) => string; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {data.map((d) => {
        const w = Math.max(0, Math.min(1, d.value / m));
        return (
          <li key={d.key} className="grid grid-cols-[minmax(6.5rem,11rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            <span className="truncate text-fg-2" title={d.label}>
              {d.label}
            </span>
            <span
              className="relative flex items-center gap-2"
              tabIndex={0}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.key)}
              onBlur={() => setHover(null)}
              aria-label={`${d.label}: ${d.display ?? formatValue(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
            >
              <span className="relative block flex-1" style={{ height }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,opacity]"
                  style={{ width: `${w * 100}%`, background: d.color ?? "var(--series-ps)", maxHeight: 24, opacity: hover && hover !== d.key ? 0.55 : 1 }}
                />
              </span>
              <span className="tnum w-20 shrink-0 whitespace-nowrap text-right text-fg">{d.display ?? formatValue(d.value)}</span>
              {hover === d.key && d.detail ? (
                <span role="status" className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-2 shadow">
                  {d.detail}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ grouped columns

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // aligned with categories
}

export function GroupedColumns({ categories, series, height = 240, formatValue = (v) => String(v), ariaLabel }: { categories: string[]; series: ColumnSeries[]; height?: number; formatValue?: (v: number) => string; ariaLabel: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; c: number; s: number } | null>(null);
  const padL = 34;
  const padB = 44;
  const padT = 14;
  const bandW = Math.max(44, series.length * 18 + 16);
  const width = padL + categories.length * bandW + 8;
  const maxV = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = niceCeil(maxV);
  const ticks = [0, niceMax / 2, niceMax];
  const barW = Math.min(24, (bandW - 12) / series.length - 2);
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / niceMax);
  return (
    <div className="relative">
      {/* Scales to the container width (viewBox) so every category stays visible. */}
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-[var(--text-3)] text-[10px] tnum">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {categories.map((c, ci) => {
          const x0 = padL + ci * bandW + (bandW - series.length * (barW + 2)) / 2;
          return (
            <g key={c}>
              {series.map((s, si) => {
                const v = s.values[ci] ?? 0;
                const x = x0 + si * (barW + 2);
                const top = y(v);
                const h = y(0) - top;
                return (
                  <g key={s.key}>
                    <path
                      d={roundedTopRect(x, top, barW, h, Math.min(4, h))}
                      fill={s.color}
                      opacity={tip && !(tip.c === ci && tip.s === si) ? 0.6 : 1}
                    />
                    <rect
                      x={x - 1}
                      y={padT}
                      width={barW + 2}
                      height={height - padT - padB}
                      fill="transparent"
                      aria-hidden="true"
                      onMouseEnter={() => setTip({ x: x + barW / 2, y: top, c: ci, s: si })}
                      onMouseLeave={() => setTip(null)}
                    />
                  </g>
                );
              })}
              <text x={padL + ci * bandW + bandW / 2} y={height - padB + 16} textAnchor="middle" className="fill-[var(--text-2)] text-[11px]">
                {c}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={width} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
      </svg>
      {tip ? (
        <Tooltip x={`${(tip.x / width) * 100}%`} y={`${(tip.y / height) * 100}%`}>
          <div className="tnum text-sm font-semibold text-fg">{formatValue(series[tip.s].values[tip.c] ?? 0)}</div>
          <div className="text-fg-3">
            {categories[tip.c]} · {series[tip.s].label}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ line chart

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[]; // aligned with x labels
}

export function LineChart({ xLabels, series, height = 220, yMax, formatValue = (v) => String(v), ariaLabel }: { xLabels: string[]; series: LineSeries[]; height?: number; yMax?: number; formatValue?: (v: number) => string; ariaLabel: string }) {
  const [idx, setIdx] = useState<number | null>(null);
  const padL = 38;
  const padR = 16;
  const padB = 28;
  const padT = 12;
  const width = 640;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const top = yMax ?? niceCeil(Math.max(1, ...all));
  const n = Math.max(1, xLabels.length - 1);
  const x = (i: number) => padL + ((width - padL - padR) * i) / n;
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / top);
  const ticks = [0, top / 2, top];
  const labelEvery = Math.ceil(xLabels.length / 6);
  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        s.values.forEach((v, i) => {
          if (v === null) return;
          d += `${d && s.values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        });
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, top, xLabels.length],
  );
  if (!xLabels.length) return null;
  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * width;
          const i = Math.round(((px - padL) / (width - padL - padR)) * n);
          setIdx(Math.max(0, Math.min(xLabels.length - 1, i)));
        }}
        onMouseLeave={() => setIdx(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-[var(--text-3)] text-[11px] tnum">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) =>
          i % labelEvery === 0 || i === xLabels.length - 1 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[11px]">
              {l}
            </text>
          ) : null,
        )}
        {idx !== null ? <line x1={x(idx)} x2={x(idx)} y1={padT} y2={height - padB} stroke="var(--border-strong)" strokeWidth={1} /> : null}
        {series.map((s, si) => (
          <g key={s.key}>
            <path d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) =>
              v !== null && (i === s.values.length - 1 || idx === i || xLabels.length <= 12) ? (
                <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ) : null,
            )}
          </g>
        ))}
      </svg>
      {idx !== null ? (
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow">
          <div className="mb-0.5 text-fg-3">{xLabels[idx]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
              <span className="tnum font-semibold text-fg">{s.values[idx] === null ? "—" : formatValue(s.values[idx] as number)}</span>
              <span className="text-fg-3">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ helpers

function roundedTopRect(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
