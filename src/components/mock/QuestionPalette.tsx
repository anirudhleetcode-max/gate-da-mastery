"use client";
import { useRef, type KeyboardEvent } from "react";
import type { MockQuestionState } from "@/lib/userdata/db";
import { PALETTE_LABEL, PALETTE_ORDER, paletteAriaLabel, paletteCounts, paletteState } from "@/lib/mock/palette";
import { PaletteGlyph } from "./PaletteGlyph";
import { cn } from "@/lib/utils";

const COLS = 5;

/** Legend of the five palette states, optionally with counts. */
export function PaletteLegend({ counts, className }: { counts?: Record<string, number>; className?: string }) {
  return (
    <ul className={cn("grid gap-1.5 text-sm", className)} aria-label="Palette legend">
      {PALETTE_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-2.5">
          <PaletteGlyph state={s} size="sm" />
          <span className="min-w-0 flex-1 text-fg-2">{PALETTE_LABEL[s]}</span>
          {counts ? <span className="tnum font-semibold text-fg">{counts[s]}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * GATE-style question palette. One tab stop (the current question); arrow
 * keys move between questions (←/→ by one, ↑/↓ by a row, Home/End), Enter or
 * Space opens the focused question.
 */
export function QuestionPalette({
  order,
  indices,
  questions,
  currentIndex,
  onSelect,
  title,
}: {
  /** All question ids in paper order (numbers are positions in this list). */
  order: string[];
  /** Positions shown here (e.g. the current section). */
  indices: number[];
  questions: Record<string, MockQuestionState>;
  currentIndex: number;
  onSelect: (index: number) => void;
  title: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const counts = paletteCounts(
    indices.map((i) => order[i]),
    questions,
  );
  const tabStop = indices.includes(currentIndex) ? currentIndex : indices[0];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const pos = refs.current.findIndex((b) => b === document.activeElement);
    if (pos < 0) return;
    let next = pos;
    if (e.key === "ArrowRight") next = pos + 1;
    else if (e.key === "ArrowLeft") next = pos - 1;
    else if (e.key === "ArrowDown") next = pos + COLS;
    else if (e.key === "ArrowUp") next = pos - COLS;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = indices.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    next = Math.max(0, Math.min(indices.length - 1, next));
    refs.current[next]?.focus();
  }

  return (
    <section aria-label={title} className="space-y-4">
      <PaletteLegend counts={counts} />
      <div
        role="group"
        aria-label={`${title}: questions`}
        data-palette=""
        onKeyDown={onKeyDown}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 2.75rem))` }}
      >
        {indices.map((i, pos) => {
          const id = order[i];
          const st = paletteState(questions[id]);
          const current = i === currentIndex;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[pos] = el;
              }}
              type="button"
              tabIndex={i === tabStop ? 0 : -1}
              aria-label={paletteAriaLabel(i + 1, st, current)}
              aria-current={current ? "step" : undefined}
              onClick={() => onSelect(i)}
              className={cn("grid h-11 w-11 place-items-center rounded-lg", current && "ring-2 ring-fg ring-offset-1 ring-offset-surface")}
            >
              <PaletteGlyph state={st}>{i + 1}</PaletteGlyph>
            </button>
          );
        })}
      </div>
    </section>
  );
}
