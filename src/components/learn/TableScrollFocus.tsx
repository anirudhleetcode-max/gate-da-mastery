"use client";
import { useEffect } from "react";

/**
 * Content tables sit in `.table-wrap` boxes, and display formulas in
 * FormulaMath boxes (`[data-scroll-x]`), that scroll sideways when wider than
 * the column. A scroll region must be reachable by keyboard (WCAG 2.1.1), so
 * this watcher makes only the boxes that actually overflow focusable (tables
 * also get a region role and label; formula boxes are already labelled
 * groups). The same approach as MathScrollFocus. Renders nothing.
 */
export function TableScrollFocus() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>(".rich .table-wrap, [data-scroll-x]")) {
        const scrolls = el.scrollWidth > el.clientWidth + 1;
        const isTable = !el.hasAttribute("data-scroll-x");
        if (scrolls && !el.hasAttribute("tabindex")) {
          el.tabIndex = 0;
          if (isTable) {
            el.setAttribute("role", "region");
            el.setAttribute("aria-label", "Table (scroll sideways to see all of it)");
          }
          el.dataset.tableFocus = "1";
        } else if (!scrolls && el.dataset.tableFocus) {
          el.removeAttribute("tabindex");
          if (isTable) {
            el.removeAttribute("role");
            el.removeAttribute("aria-label");
          }
          delete el.dataset.tableFocus;
        }
      }
    };
    let live = true;
    const schedule = () => {
      if (live && !frame) frame = requestAnimationFrame(update);
    };
    schedule();
    // Re-check when a box changes size: window resizes, late web fonts (KaTeX) and boxes shown again by the formula-book view switch.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (ro) for (const el of document.querySelectorAll<HTMLElement>(".rich .table-wrap, [data-scroll-x]")) ro.observe(el);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      live = false;
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
