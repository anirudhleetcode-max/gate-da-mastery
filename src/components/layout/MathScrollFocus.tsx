"use client";
import { useEffect } from "react";

/**
 * Display formulas scroll sideways when they are wider than their column
 * (`.rich .math-display { overflow-x: auto }`). A scroll region must be
 * reachable by keyboard (WCAG 2.1.1; axe "scrollable-region-focusable"), but
 * making every formula a tab stop would add noise. This watcher makes only
 * the formulas that actually overflow focusable, and labels them.
 */
export function MathScrollFocus() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>(".math-display")) {
        const scrolls = el.scrollWidth > el.clientWidth + 1;
        if (scrolls && !el.hasAttribute("tabindex")) {
          el.tabIndex = 0;
          el.setAttribute("role", "group");
          el.setAttribute("aria-label", "Formula (scroll sideways to see all of it)");
          el.dataset.scrollFocus = "1";
        } else if (!scrolls && el.dataset.scrollFocus) {
          el.removeAttribute("tabindex");
          el.removeAttribute("role");
          el.removeAttribute("aria-label");
          delete el.dataset.scrollFocus;
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
