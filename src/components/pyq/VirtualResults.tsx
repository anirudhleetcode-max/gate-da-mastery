"use client";
/**
 * Window-scrolled virtual list of grouped PYQ results with a sticky group
 * header. Rows are measured (their preview wraps to one or two lines), and
 * the first rows are rendered statically during SSR / hydration so the list
 * is visible before JavaScript runs.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { QuestionMeta } from "@/lib/content/types";
import { SUBJECT_COLOR } from "@/lib/labels";
import { cn, plural } from "@/lib/utils";
import { marksLabel } from "./data";
import type { ResultGroup, ResultItem } from "./filters";
import { takeListAnchor } from "./useNavList";

/** Height of the app's sticky top bar (h-14). */
const APP_BAR = 56;
const HEADER_H = 52;
const ROW_ESTIMATE = 112;
const STATIC_ROWS = 14;

const noopSubscribe = () => () => {};

export function GroupHeader({ group, overlay = false }: { group: ResultGroup; overlay?: boolean }) {
  const Title = overlay ? "p" : "h3";
  return (
    <div
      aria-hidden={overlay || undefined}
      className={cn(
        "flex items-center gap-3 border-b border-border bg-surface-2 px-3 sm:px-4",
        overlay && "rounded-b-md border-x shadow-[var(--shadow)]",
      )}
      style={{ height: HEADER_H }}
    >
      {group.subjectId ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[group.subjectId] }} /> : null}
      <div className="min-w-0 flex-1">
        <Title className="truncate text-sm font-semibold leading-5 text-fg">{group.title}</Title>
        {group.detail ? <p className="truncate text-xs leading-4 text-fg-3">{group.detail}</p> : null}
      </div>
      <div className="tnum shrink-0 text-right text-xs leading-4 text-fg-3">
        <div className="font-medium text-fg-2">{plural(group.count, "question")}</div>
        <div>{marksLabel(group.marks)}</div>
      </div>
    </div>
  );
}

export function VirtualResults({
  items,
  groups,
  renderRow,
  onTop,
}: {
  items: ResultItem[];
  groups: ResultGroup[];
  renderRow: (meta: QuestionMeta, isLast: boolean) => ReactNode;
  /** Reports the list's document offset (used to scroll back to the top of new results). */
  onTop?: (top: number) => void;
}) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [scrollMargin, setScrollMargin] = useState(0);

  // The list's distance from the top of the document changes whenever content above it
  // (filter chips, banners) reflows; the body's size changes with it.
  const measureRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const measure = () => {
        const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
        setScrollMargin(top);
        onTop?.(top);
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(document.body);
      return () => ro.disconnect();
    },
    [onTop],
  );

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (i) => (items[i]?.kind === "header" ? HEADER_H : ROW_ESTIMATE),
    getItemKey: (i) => items[i]?.key ?? i,
    overscan: 8,
    scrollMargin,
    useFlushSync: false,
  });

  // Back from a question: bring the row the student opened into view and give it focus again.
  const restored = useRef(false);
  useEffect(() => {
    if (!mounted || restored.current || scrollMargin <= 0) return;
    restored.current = true;
    const id = takeListAnchor();
    const index = id ? items.findIndex((it) => it.kind === "row" && it.key === id) : -1;
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: "center" });
    let tries = 0;
    const focusRow = () => {
      const link = document.querySelector<HTMLAnchorElement>(`[data-index="${index}"] a[href="/questions/${id}"]`);
      if (link) link.focus({ preventScroll: true });
      else if (++tries < 10) window.setTimeout(focusRow, 50);
    };
    window.setTimeout(focusRow, 50);
  }, [mounted, scrollMargin, items, virtualizer]);

  const renderItem = (it: ResultItem, index: number) =>
    it.kind === "header" ? <GroupHeader group={groups[it.groupIndex]} /> : renderRow(it.meta, index === items.length - 1);

  if (!mounted) {
    return (
      <div ref={measureRef}>
        <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
          {items.slice(0, STATIC_ROWS).map((it, i) => (
            <div key={it.key}>{renderItem(it, i)}</div>
          ))}
        </div>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  // Sticky header: the group of the first item crossing the bottom edge of the app bar.
  const line = (virtualizer.scrollOffset ?? 0) + APP_BAR;
  let active = -1;
  if (line > scrollMargin) {
    const first = virtualItems.find((v) => v.end > line);
    if (first) active = items[first.index]?.groupIndex ?? -1;
  }

  return (
    <div ref={measureRef} className="relative">
      <div className="sticky top-14 z-10 h-0">{active >= 0 ? <GroupHeader group={groups[active]} overlay /> : null}</div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualItems.map((v) => {
            const it = items[v.index];
            if (!it) return null;
            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${v.start - scrollMargin}px)` }}
              >
                {renderItem(it, v.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
