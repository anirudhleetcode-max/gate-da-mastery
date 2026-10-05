"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { PrintButton } from "./PrintButton";
import { usePersistentValue } from "./persist";

const VIEW_KEY = "gate-da-formula-view";

/**
 * Wraps a subject's formula cards with a view switch: full cards, or the
 * formulas alone for quick revision (and a compact printout). The choice is
 * remembered on this device. Cards hide their details through the
 * `group/book` data attribute, so the server-rendered cards stay as they are.
 *
 * Switching the view changes the page height a lot, so it keeps the reader's
 * place: a switch from the control keeps the card at the top of the screen in
 * place, and when the saved "Formulas only" view replaces the server-rendered
 * full cards right after loading, a linked card (/formulas/<subject>#<id>) is
 * scrolled back into view.
 */
export function FormulaBookView({ children, count }: { children: ReactNode; count: number }) {
  const [raw, set] = usePersistentValue("local", VIEW_KEY);
  const compact = raw === "compact";
  const keep = useRef<{ id: string; top: number } | null>(null);

  function choose(next: "full" | "compact") {
    keep.current = null;
    for (const card of document.querySelectorAll<HTMLElement>(".formula-card")) {
      // The card's scroll-margin is the space the sticky header (and topic bar) cover.
      const gap = parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
      const r = card.getBoundingClientRect();
      if (r.bottom > gap) {
        keep.current = { id: card.id, top: Math.max(r.top, gap) };
        break;
      }
    }
    set(next === "compact" ? "compact" : null);
  }

  // Scroll-only effect (no state): runs after the view's layout has changed.
  useLayoutEffect(() => {
    const k = keep.current;
    keep.current = null;
    if (k) {
      const el = document.getElementById(k.id);
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - k.top);
      return;
    }
    if (!compact || !window.location.hash) return;
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = id ? document.getElementById(id) : null;
    if (target?.closest(".formula-card, [id^='topic-']")) target.scrollIntoView({ block: "start" });
  }, [compact]);

  return (
    <div data-compact={compact ? "true" : "false"} className="group/book">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-sm text-fg-3">
            View
          </span>
          <Segmented
            label="Formula book view"
            value={compact ? "compact" : "full"}
            onChange={choose}
            options={[
              { value: "full", label: "Full cards" },
              { value: "compact", label: "Formulas only" },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-fg-3 md:block">{compact ? `Showing ${count} formulas without explanations.` : "Prints the view you choose."}</p>
          <PrintButton />
        </div>
      </div>
      {children}
    </div>
  );
}
