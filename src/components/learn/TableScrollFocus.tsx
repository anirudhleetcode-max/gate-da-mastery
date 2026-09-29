"use client";
import { useEffect } from "react";

/**
 * Content tables sit in `.table-wrap` boxes that scroll sideways when the
 * table is wider than the column. A scroll region must be reachable by
 * keyboard (WCAG 2.1.1), so this watcher makes only the tables that actually
 * overflow focusable and labels them (the same approach MathScrollFocus
 * takes for display formulas). Renders nothing.
 */
export function TableScrollFocus() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>(".rich .table-wrap")) {
        const scrolls = el.scrollWidth > el.clientWidth + 1;
        if (scrolls && !el.hasAttribute("tabindex")) {
          el.tabIndex = 0;
          el.setAttribute("role", "region");
          el.setAttribute("aria-label", "Table (scroll sideways to see all of it)");
          el.dataset.tableFocus = "1";
        } else if (!scrolls && el.dataset.tableFocus) {
          el.removeAttribute("tabindex");
          el.removeAttribute("role");
          el.removeAttribute("aria-label");
          delete el.dataset.tableFocus;
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
