import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { PaletteState } from "@/lib/mock/palette";
import { cn } from "@/lib/utils";

/**
 * The visual marker of a palette state. States never rely on colour alone:
 *  - Not visited:        outlined square
 *  - Not answered:       filled shape rounded at the BOTTOM
 *  - Answered:           filled shape rounded at the TOP, with a check badge
 *  - Marked for review:  filled circle
 *  - Answered & marked:  filled circle with a check badge
 * The check badge always means "answered"; the circle always means "marked".
 * Text on filled shapes uses the surface colour, so it stays readable in both themes.
 */
const SHAPE: Record<PaletteState, string> = {
  not_visited: "rounded-[5px] border border-border-strong bg-surface-2 text-fg-2",
  not_answered: "rounded-t-[5px] rounded-b-[45%] border border-danger bg-danger text-surface",
  answered: "rounded-t-[45%] rounded-b-[5px] border border-success bg-success text-surface",
  marked: "rounded-full border border-accent bg-accent text-surface",
  answered_marked: "rounded-full border border-accent bg-accent text-surface",
};

const SIZE = {
  sm: { box: "h-5 w-5 text-[0.6rem]", badge: "-bottom-1 -right-1 h-3 w-3", icon: "h-2 w-2" },
  md: { box: "h-10 w-10 text-sm", badge: "-bottom-1 -right-1 h-4 w-4", icon: "h-2.5 w-2.5" },
} as const;

export function PaletteGlyph({ state, size = "md", children, className }: { state: PaletteState; size?: keyof typeof SIZE; children?: ReactNode; className?: string }) {
  const s = SIZE[size];
  const answered = state === "answered" || state === "answered_marked";
  return (
    <span aria-hidden className={cn("relative inline-grid shrink-0 place-items-center font-semibold leading-none", s.box, SHAPE[state], className)}>
      <span className="tnum">{children}</span>
      {answered ? (
        <span className={cn("absolute grid place-items-center rounded-full bg-surface text-success ring-1 ring-success", s.badge)}>
          <Check className={s.icon} strokeWidth={4} />
        </span>
      ) : null}
    </span>
  );
}
