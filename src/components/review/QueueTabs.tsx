"use client";
/**
 * Queue selector: an ARIA tablist laid out as a grid of count tiles, so every
 * queue's size is visible at a glance on phones and desktops alike.
 */
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface QueueTab<T extends string> {
  id: T;
  label: string;
  count: number;
  /** Tone of the count (e.g. danger for overdue work). */
  emphasis?: boolean;
  /** What the emphasis means, for screen readers (colour is never the only signal). */
  emphasisLabel?: string;
}

export function QueueTabs<T extends string>({ tabs, value, onChange, panelId, label }: { tabs: QueueTab<T>[]; value: T; onChange: (v: T) => void; panelId: string; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    let j: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault();
    onChange(tabs[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "flex min-h-[3.75rem] flex-col items-start justify-between gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
              active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span aria-hidden className={cn("tnum text-xl font-semibold leading-6", t.emphasis && t.count > 0 ? "text-danger" : "text-fg")}>
              {t.count}
            </span>
            <span className={cn("text-xs font-medium leading-4", active ? "text-accent-text" : "text-fg-2")}>
              {t.label}
              <span className="sr-only">
                {", "}
                {t.count} {t.count === 1 ? "item" : "items"}
                {t.emphasis && t.count > 0 && t.emphasisLabel ? `, ${t.emphasisLabel}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
